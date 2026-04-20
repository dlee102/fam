#!/usr/bin/env python3
"""
Quant V2 — 모델 학습 및 평가

build_quant_v2_dataset.py 가 생성한 CSV를 읽어:
  1) 피처별 Spearman 상관 / AUC
  2) 시간 기반 분할 (앞 70% train / 뒤 30% test)
  3) 로지스틱 회귀 (L2, 표준화)
  4) LightGBM (num_leaves=8, 과적합 방지)
  5) 평가 보고서 + 모델 계수 JSON + 전체 article 예측 JSON 출력

출력:
  data/analysis/quant_v2_evaluation.md
  data/analysis/quant_v2_model.json
  data/home_feed_quant_scores.json  (기존 파일 대체)

사용:
  python3 scripts/train_quant_v2.py
"""
from __future__ import annotations

import csv
import json
import math
import warnings
from datetime import datetime
from pathlib import Path

import numpy as np
from scipy import stats as sp_stats
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    roc_auc_score,
    accuracy_score,
    precision_score,
    recall_score,
    brier_score_loss,
)

warnings.filterwarnings("ignore", category=UserWarning)

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "analysis" / "quant_v2_features.csv"
OUT_EVAL = ROOT / "data" / "analysis" / "quant_v2_evaluation.md"
OUT_MODEL = ROOT / "data" / "analysis" / "quant_v2_model.json"
OUT_SCORES = ROOT / "data" / "home_feed_quant_scores.json"

FEATURE_COLS = [
    "ma5_20_spread", "atr_ratio", "bb_pct_b", "bb_width",
    "rsi14", "momentum10d", "vol_ratio20", "vol_spike_ratio",
    "pub_hour", "pub_weekday", "entry_vs_prev_close", "entry_vs_prev_low",
    "ret_1d_pre", "close_vs_ma20", "gap_open_pct",
    "sentiment_positive", "sentiment_negative",
    "sentiment_confidence", "catalyst_bullish", "catalyst_bearish",
]


STRING_COLS = {"article_id", "ticker", "t0", "published_at"}


def load_data() -> list[dict]:
    rows: list[dict] = []
    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            parsed: dict = {}
            for k, v in r.items():
                if v == "" or v is None:
                    parsed[k] = None
                elif k in STRING_COLS:
                    parsed[k] = v
                else:
                    try:
                        parsed[k] = float(v)
                    except ValueError:
                        parsed[k] = v
            rows.append(parsed)
    return rows


# ── 복합 우상향 라벨 설정 ──────────────────────────────────────────────────
# "튼튼하게 우상향"이란 뉴스 발행 후 1·3·5·8거래일 모두에 걸쳐 꾸준히 오르는 것.
# 단순 T+1 수익 > 1% 대신, 다중 horizon 가중 평균으로 라벨 정의:
#   composite = 0.10·ret_1d + 0.25·ret_3d + 0.30·ret_5d + 0.35·ret_8d
# 장기 horizon에 더 높은 가중치를 줘서 하루 급등 후 빠지는 패턴을 불이익.
COMPOSITE_WEIGHTS = {"ret_1d": 0.10, "ret_3d": 0.25, "ret_5d": 0.30, "ret_8d": 0.35}
COMPOSITE_THRESHOLD = 2.0  # 가중 복합 수익률이 2% 초과여야 "우상향"으로 분류

CRASH_THRESHOLD = -5.0     # ret_1d < -5% → 폭락 위험


def composite_return(r: dict) -> float | None:
    """가중 복합 수익률 계산. 어느 horizon이라도 없으면 None."""
    vals = {}
    for col in COMPOSITE_WEIGHTS:
        v = r.get(col)
        if v is None:
            return None
        vals[col] = float(v)
    return sum(COMPOSITE_WEIGHTS[k] * vals[k] for k in COMPOSITE_WEIGHTS)


def make_arrays(rows: list[dict], feature_cols: list[str]) -> tuple[np.ndarray, np.ndarray]:
    """
    우상향 라벨: composite_return > COMPOSITE_THRESHOLD.
    1·3·5·8거래일 모두 있어야 라벨 확정 (없으면 0으로 처리 — build 단계서 이미 필터됨).
    """
    X = np.zeros((len(rows), len(feature_cols)))
    y = np.zeros(len(rows))
    for i, r in enumerate(rows):
        for j, col in enumerate(feature_cols):
            val = r.get(col)
            X[i, j] = float(val) if val is not None else 0.0
        comp = composite_return(r)
        y[i] = 1.0 if comp is not None and comp > COMPOSITE_THRESHOLD else 0.0
    return X, y


def make_crash_arrays(rows: list[dict], feature_cols: list[str]) -> tuple[np.ndarray, np.ndarray]:
    """폭락 라벨: ret_1d < CRASH_THRESHOLD (−5% 이상 급락)."""
    X = np.zeros((len(rows), len(feature_cols)))
    y = np.zeros(len(rows))
    for i, r in enumerate(rows):
        for j, col in enumerate(feature_cols):
            val = r.get(col)
            X[i, j] = float(val) if val is not None else 0.0
        ret = r.get("ret_1d")
        y[i] = 1.0 if ret is not None and float(ret) < CRASH_THRESHOLD else 0.0
    return X, y


def train_crash_logistic(
    X_train: np.ndarray, y_crash_train: np.ndarray,
    X_test: np.ndarray, y_crash_test: np.ndarray,
    feature_cols: list[str],
) -> dict:
    """폭락(-5%) 이진 분류 로지스틱. 폭락 클래스 소수이므로 class_weight='balanced' 사용."""
    scaler = StandardScaler()
    X_tr_s = scaler.fit_transform(X_train)
    X_te_s = scaler.transform(X_test)
    model = LogisticRegression(C=0.3, max_iter=1000, solver="lbfgs",
                               class_weight="balanced", random_state=42)
    model.fit(X_tr_s, y_crash_train)
    prob_train = model.predict_proba(X_tr_s)[:, 1]
    prob_test  = model.predict_proba(X_te_s)[:, 1]
    train_auc = roc_auc_score(y_crash_train, prob_train) if y_crash_train.sum() > 0 else 0.5
    test_auc  = roc_auc_score(y_crash_test, prob_test)   if y_crash_test.sum()  > 0 else 0.5
    crash_rate_train = float(np.mean(y_crash_train)) * 100
    crash_rate_test  = float(np.mean(y_crash_test))  * 100
    coefs = {col: round(float(c), 6) for col, c in zip(feature_cols, model.coef_[0])}
    intercept = round(float(model.intercept_[0]), 6)
    return {
        "model": model,
        "scaler": scaler,
        "prob_train": prob_train,
        "prob_test": prob_test,
        "train_auc": round(train_auc, 4),
        "test_auc": round(test_auc, 4),
        "crash_rate_train": round(crash_rate_train, 2),
        "crash_rate_test": round(crash_rate_test, 2),
        "coefs": coefs,
        "intercept": intercept,
        "scaler_mean":  {col: round(float(m), 6) for col, m in zip(feature_cols, scaler.mean_)},
        "scaler_scale": {col: round(float(s), 6) for col, s in zip(feature_cols, scaler.scale_)},
    }


def feature_analysis(rows: list[dict], feature_cols: list[str]) -> list[dict]:
    """Per-feature Spearman correlation with composite return and binary AUC."""
    results = []
    comp_rets = np.array([
        composite_return(r) if composite_return(r) is not None else 0.0
        for r in rows
    ])
    y_bin = (comp_rets > COMPOSITE_THRESHOLD).astype(float)
    for col in feature_cols:
        vals = np.array([float(r.get(col) or 0) for r in rows])
        mask = ~np.isnan(vals) & ~np.isnan(comp_rets)
        if mask.sum() < 30:
            results.append({"feature": col, "spearman_r": None, "p_value": None, "auc": 0.5})
            continue
        rho, pval = sp_stats.spearmanr(vals[mask], comp_rets[mask])
        try:
            auc = roc_auc_score(y_bin[mask], vals[mask])
        except ValueError:
            auc = 0.5
        auc_dir = auc if auc >= 0.5 else 1 - auc
        results.append({
            "feature": col,
            "spearman_r": round(rho, 4),
            "p_value": round(pval, 6),
            "auc_raw": round(auc, 4),
            "auc_abs": round(auc_dir, 4),
        })
    return sorted(results, key=lambda x: -(x.get("auc_abs") or 0.5))


def train_logistic(X_train, y_train, X_test, y_test, feature_cols):
    scaler = StandardScaler()
    X_tr_s = scaler.fit_transform(X_train)
    X_te_s = scaler.transform(X_test)

    model = LogisticRegression(C=0.5, max_iter=1000, solver="lbfgs", random_state=42)
    model.fit(X_tr_s, y_train)

    prob_train = model.predict_proba(X_tr_s)[:, 1]
    prob_test = model.predict_proba(X_te_s)[:, 1]

    train_auc = roc_auc_score(y_train, prob_train)
    test_auc = roc_auc_score(y_test, prob_test)
    test_acc = accuracy_score(y_test, (prob_test >= 0.5).astype(int))
    test_brier = brier_score_loss(y_test, prob_test)

    coefs = {col: round(float(c), 6) for col, c in zip(feature_cols, model.coef_[0])}
    intercept = round(float(model.intercept_[0]), 6)

    return {
        "model": model,
        "scaler": scaler,
        "prob_train": prob_train,
        "prob_test": prob_test,
        "train_auc": round(train_auc, 4),
        "test_auc": round(test_auc, 4),
        "test_acc": round(test_acc, 4),
        "test_brier": round(test_brier, 4),
        "coefs": coefs,
        "intercept": intercept,
        "scaler_mean": {col: round(float(m), 6) for col, m in zip(feature_cols, scaler.mean_)},
        "scaler_scale": {col: round(float(s), 6) for col, s in zip(feature_cols, scaler.scale_)},
    }


def train_gbm(X_train, y_train, X_test, y_test, feature_cols):
    try:
        import lightgbm as lgb
    except ImportError:
        return None

    params = {
        "objective": "binary",
        "metric": "auc",
        "num_leaves": 8,
        "max_depth": 4,
        "learning_rate": 0.05,
        "n_estimators": 200,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "min_child_samples": 20,
        "reg_alpha": 0.1,
        "reg_lambda": 1.0,
        "random_state": 42,
        "verbose": -1,
    }

    model = lgb.LGBMClassifier(**params)
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        callbacks=[lgb.log_evaluation(period=0)],
    )

    prob_train = model.predict_proba(X_train)[:, 1]
    prob_test = model.predict_proba(X_test)[:, 1]

    train_auc = roc_auc_score(y_train, prob_train)
    test_auc = roc_auc_score(y_test, prob_test)
    test_acc = accuracy_score(y_test, (prob_test >= 0.5).astype(int))
    test_brier = brier_score_loss(y_test, prob_test)

    importances = {col: round(float(v), 4) for col, v in zip(feature_cols, model.feature_importances_)}

    return {
        "model": model,
        "prob_train": prob_train,
        "prob_test": prob_test,
        "train_auc": round(train_auc, 4),
        "test_auc": round(test_auc, 4),
        "test_acc": round(test_acc, 4),
        "test_brier": round(test_brier, 4),
        "importances": importances,
    }


def evaluate_random_baseline(
    y_train: np.ndarray,
    y_test: np.ndarray,
    *,
    n_trials: int = 10_000,
    seed: int = 42,
) -> dict[str, float | int]:
    """
    학습·테스트 각각에 대해 [0,1] 균등분포 무작위 확률을 부여하고 지표를 계산한 뒤,
    trial 전체의 산술평균을 반환한다 (단일 시드로 재현 가능).

    Brier 기대값은 모든 샘플에 상수 0.5를 쓸 때의 0.25가 아니라,
    샘플마다 다른 무작위 확률을 쓰므로 평균 약 1/3(≈0.333)에 수렴한다.
    """
    rng = np.random.default_rng(seed)
    n_tr, n_te = int(len(y_train)), int(len(y_test))
    y_tr = np.asarray(y_train, dtype=float)
    y_te = np.asarray(y_test, dtype=float)

    train_aucs: list[float] = []
    test_aucs: list[float] = []
    test_accs: list[float] = []
    test_briers: list[float] = []

    for _ in range(n_trials):
        p_tr = rng.uniform(0.0, 1.0, n_tr)
        p_te = rng.uniform(0.0, 1.0, n_te)
        train_aucs.append(roc_auc_score(y_tr, p_tr))
        test_aucs.append(roc_auc_score(y_te, p_te))
        test_accs.append(accuracy_score(y_te, (p_te >= 0.5).astype(int)))
        test_briers.append(brier_score_loss(y_te, p_te))

    return {
        "train_auc": round(float(np.mean(train_aucs)), 4),
        "test_auc": round(float(np.mean(test_aucs)), 4),
        "test_acc": round(float(np.mean(test_accs)), 4),
        "test_brier": round(float(np.mean(test_briers)), 4),
        "n_trials": n_trials,
        "seed": seed,
    }


def quintile_analysis(
    y_true: np.ndarray,
    probs: np.ndarray,
    comp_returns: np.ndarray,
    ret_1d: np.ndarray,
    ret_3d: np.ndarray,
    ret_5d: np.ndarray,
    ret_8d: np.ndarray,
    n_q: int = 5,
) -> list[dict]:
    """점수 분위별 승률 + 각 horizon 평균 수익률."""
    order = np.argsort(probs)
    chunk = len(order) // n_q
    results = []
    for q in range(n_q):
        start = q * chunk
        end = (q + 1) * chunk if q < n_q - 1 else len(order)
        idx = order[start:end]
        n = len(idx)
        results.append({
            "quintile": q + 1,
            "n": n,
            "avg_prob": round(float(np.mean(probs[idx])), 4),
            "win_rate": round(float(np.mean(y_true[idx])) * 100, 1),
            "avg_comp_ret": round(float(np.mean(comp_returns[idx])), 3),
            "avg_ret_1d": round(float(np.mean(ret_1d[idx])), 3),
            "avg_ret_3d": round(float(np.mean(ret_3d[idx])), 3),
            "avg_ret_5d": round(float(np.mean(ret_5d[idx])), 3),
            "avg_ret_8d": round(float(np.mean(ret_8d[idx])), 3),
        })
    return results


def generate_report(
    n_total: int, n_train: int, n_test: int,
    base_rate_train: float, base_rate_test: float,
    feat_analysis: list[dict],
    lr_result: dict,
    gbm_result: dict | None,
    lr_quintiles_test: list[dict],
    gbm_quintiles_test: list[dict] | None,
    selected_features: list[str],
    random_bl: dict[str, float | int],
    crash_result: dict | None = None,
) -> str:
    weights_str = " + ".join(f"{w}·r{k[4:]}" for k, w in COMPOSITE_WEIGHTS.items())
    lines = [
        "# Quant Score V2 — 모델 평가 보고서",
        f"\n생성: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"\n## 1. 데이터 개요",
        f"- 전체: **{n_total}건** (기사-종목 이벤트)",
        f"- 학습: {n_train}건 (시간순 앞 70%)",
        f"- 테스트: {n_test}건 (시간순 뒤 30%)",
        f"- **우상향 라벨**: 복합 수익({weights_str}) > {COMPOSITE_THRESHOLD}%",
        f"  - 학습 우상향 비율: {base_rate_train:.1f}% / 테스트: {base_rate_test:.1f}%",
        f"  - 단기 급등 후 하락하는 패턴에는 낮은 점수를 부여하도록 장기 horizon에 높은 가중치 적용",
        "",
        "## 2. 피처별 상관 분석 (전체 데이터)",
        "| 피처 | Spearman r | p-value | AUC(방향보정) |",
        "|------|-----------|---------|--------------|",
    ]
    for fa in feat_analysis:
        r = fa.get("spearman_r")
        p = fa.get("p_value")
        auc = fa.get("auc_abs", 0.5)
        sig = "***" if p is not None and p < 0.01 else "**" if p is not None and p < 0.05 else "*" if p is not None and p < 0.1 else ""
        r_str = f"{r:+.4f}{sig}" if r is not None else "—"
        p_str = f"{p:.6f}" if p is not None else "—"
        lines.append(f"| {fa['feature']} | {r_str} | {p_str} | {auc:.4f} |")
    lines.append("")

    lines += [
        f"## 3. 선택된 피처 ({len(selected_features)}개)",
        f"p < 0.15 또는 AUC > 0.52 기준:",
        ", ".join(f"`{f}`" for f in selected_features),
        "",
    ]

    lines += [
        "## 4. 모델 성능 비교",
        "| 모델 | Train AUC | Test AUC | Test 정확도 | Brier Score |",
        "|------|-----------|----------|-----------|-------------|",
        f"| 로지스틱 회귀 | {lr_result['train_auc']} | {lr_result['test_auc']} | {lr_result['test_acc']} | {lr_result['test_brier']} |",
    ]
    if gbm_result:
        lines.append(
            f"| LightGBM | {gbm_result['train_auc']} | {gbm_result['test_auc']} | {gbm_result['test_acc']} | {gbm_result['test_brier']} |"
        )
    rb_n = int(random_bl["n_trials"])
    lines.append(
        f"| 무작위 추정 ([0,1] 균등 확률, {rb_n:,}회 평균) | "
        f"{random_bl['train_auc']} | {random_bl['test_auc']} | {random_bl['test_acc']} | {random_bl['test_brier']} |"
    )
    lines.append("")
    lines.append(
        f"*무작위 행: 테스트 각 행에 독립 균등 확률을 부여해 AUC·정확도·Brier를 계산하고, "
        f"이를 {rb_n:,}회 반복한 산술평균입니다 (seed={random_bl['seed']}). "
        f"테스트 양전 비율 {base_rate_test:.1f}%일 때 ‘항상 양전’만 고르면 정확도는 약 {base_rate_test:.1f}%가 되며, 무작위와는 별개입니다.*"
    )
    lines.append("")

    lines += [
        "## 5. 로지스틱 회귀 계수",
        "| 피처 | 계수 (표준화) | 방향 해석 |",
        "|------|-------------|----------|",
    ]
    for col, coef in sorted(lr_result["coefs"].items(), key=lambda x: -abs(x[1])):
        direction = "양전 유리" if coef > 0 else "양전 불리"
        lines.append(f"| {col} | {coef:+.6f} | {direction} |")
    lines.append(f"| (절편) | {lr_result['intercept']:+.6f} | |")
    lines.append("")

    if gbm_result:
        lines += [
            "## 6. LightGBM 피처 중요도",
            "| 피처 | 중요도 (split) |",
            "|------|---------------|",
        ]
        for col, imp in sorted(gbm_result["importances"].items(), key=lambda x: -x[1]):
            lines.append(f"| {col} | {imp} |")
        lines.append("")

    lines += [
        "## 7. 테스트셋 분위별 성과 (로지스틱 회귀)",
        "| 분위 | N | 평균확률 | 우상향 승률 | 복합 수익 | T+1 | T+3 | T+5 | T+8 |",
        "|------|---|---------|-----------|---------|-----|-----|-----|-----|",
    ]
    for q in lr_quintiles_test:
        lines.append(
            f"| Q{q['quintile']} | {q['n']} | {q['avg_prob']:.4f} | {q['win_rate']:.1f}% "
            f"| {q['avg_comp_ret']:+.2f}% | {q['avg_ret_1d']:+.2f}% | {q['avg_ret_3d']:+.2f}% "
            f"| {q['avg_ret_5d']:+.2f}% | {q['avg_ret_8d']:+.2f}% |"
        )
    lines.append("")

    if gbm_quintiles_test:
        lines += [
            "## 8. 테스트셋 분위별 성과 (LightGBM)",
            "| 분위 | N | 평균확률 | 우상향 승률 | 복합 수익 | T+1 | T+3 | T+5 | T+8 |",
            "|------|---|---------|-----------|---------|-----|-----|-----|-----|",
        ]
        for q in gbm_quintiles_test:
            lines.append(
                f"| Q{q['quintile']} | {q['n']} | {q['avg_prob']:.4f} | {q['win_rate']:.1f}% "
                f"| {q['avg_comp_ret']:+.2f}% | {q['avg_ret_1d']:+.2f}% | {q['avg_ret_3d']:+.2f}% "
                f"| {q['avg_ret_5d']:+.2f}% | {q['avg_ret_8d']:+.2f}% |"
            )
        lines.append("")

    if crash_result:
        lines += [
            "## 9. 폭락 위험 모델 (ret < −5%)",
            f"- 학습 폭락 비율: {crash_result['crash_rate_train']:.1f}%",
            f"- 테스트 폭락 비율: {crash_result['crash_rate_test']:.1f}%",
            f"- 폭락 예측 Train AUC: {crash_result['train_auc']}",
            f"- 폭락 예측 Test AUC: {crash_result['test_auc']}",
            "",
            "| 피처 | 계수 (표준화) | 해석 |",
            "|------|-------------|------|",
        ]
        for col, coef in sorted(crash_result["coefs"].items(), key=lambda x: -abs(x[1])):
            direction = "폭락 위험↑" if coef > 0 else "폭락 위험↓"
            lines.append(f"| {col} | {coef:+.6f} | {direction} |")
        lines.append("")

    lines += [
        "## 10. 결론 및 권고",
        "",
        "---",
        "*이 보고서는 scripts/train_quant_v2.py 로 자동 생성됩니다.*",
    ]
    return "\n".join(lines)


def main() -> None:
    if not CSV_PATH.is_file():
        print(f"CSV 없음: {CSV_PATH}")
        print("먼저 python3 scripts/build_quant_v2_dataset.py 실행")
        return

    print("데이터 로드...")
    rows = load_data()
    n_total = len(rows)
    print(f"  {n_total}건 로드")

    print("\n피처 상관 분석...")
    feat_analysis = feature_analysis(rows, FEATURE_COLS)
    for fa in feat_analysis:
        print(f"  {fa['feature']:25s}  rho={fa.get('spearman_r', 0):+.4f}  p={fa.get('p_value', 1):.4f}  AUC={fa.get('auc_abs', 0.5):.4f}")

    selected_features = [
        fa["feature"] for fa in feat_analysis
        if (fa.get("p_value") is not None and fa["p_value"] < 0.15)
        or (fa.get("auc_abs") is not None and fa["auc_abs"] > 0.52)
    ]
    if len(selected_features) < 3:
        selected_features = [fa["feature"] for fa in feat_analysis[:10]]
    print(f"\n선택된 피처 ({len(selected_features)}개): {selected_features}")

    split_idx = int(n_total * 0.7)
    train_rows = rows[:split_idx]
    test_rows = rows[split_idx:]

    X_train_full, y_train = make_arrays(train_rows, FEATURE_COLS)
    X_test_full, y_test = make_arrays(test_rows, FEATURE_COLS)

    _, y_crash_train = make_crash_arrays(train_rows, FEATURE_COLS)
    _, y_crash_test  = make_crash_arrays(test_rows,  FEATURE_COLS)

    sel_indices = [FEATURE_COLS.index(f) for f in selected_features]
    X_train_sel = X_train_full[:, sel_indices]
    X_test_sel = X_test_full[:, sel_indices]

    base_rate_train = float(np.mean(y_train)) * 100
    base_rate_test = float(np.mean(y_test)) * 100
    print(f"\n학습: {len(train_rows)}건 (복합우상향>{COMPOSITE_THRESHOLD}% {base_rate_train:.1f}%)")
    print(f"테스트: {len(test_rows)}건 (복합우상향>{COMPOSITE_THRESHOLD}% {base_rate_test:.1f}%)")
    print(f"  폭락<{CRASH_THRESHOLD}%: 학습 {float(np.mean(y_crash_train))*100:.1f}% / 테스트 {float(np.mean(y_crash_test))*100:.1f}%")

    print("\n로지스틱 회귀 학습...")
    lr_result = train_logistic(X_train_sel, y_train, X_test_sel, y_test, selected_features)
    print(f"  Train AUC: {lr_result['train_auc']}")
    print(f"  Test AUC:  {lr_result['test_auc']}")
    print(f"  Test Acc:  {lr_result['test_acc']}")

    print("\nLightGBM 학습...")
    gbm_result = train_gbm(X_train_sel, y_train, X_test_sel, y_test, selected_features)
    if gbm_result:
        print(f"  Train AUC: {gbm_result['train_auc']}")
        print(f"  Test AUC:  {gbm_result['test_auc']}")
        print(f"  Test Acc:  {gbm_result['test_acc']}")

    print("\n폭락 위험 모델 학습 (로지스틱, class_weight=balanced)...")
    crash_result = train_crash_logistic(X_train_sel, y_crash_train, X_test_sel, y_crash_test, selected_features)
    print(f"  폭락 비율: 학습 {crash_result['crash_rate_train']:.1f}% / 테스트 {crash_result['crash_rate_test']:.1f}%")
    print(f"  Train AUC: {crash_result['train_auc']}")
    print(f"  Test AUC:  {crash_result['test_auc']}")

    print("\n무작위 기준선 (Monte Carlo)...")
    random_bl = evaluate_random_baseline(y_train, y_test, n_trials=10_000, seed=42)
    print(
        f"  {random_bl['n_trials']}회 평균 — Train AUC {random_bl['train_auc']}, "
        f"Test AUC {random_bl['test_auc']}, Test Acc {random_bl['test_acc']}, Brier {random_bl['test_brier']}"
    )

    def safe_rets(rows: list[dict], col: str) -> np.ndarray:
        return np.array([float(r.get(col) or 0) for r in rows])

    comp_test = np.array([composite_return(r) or 0.0 for r in test_rows])
    r1_test = safe_rets(test_rows, "ret_1d")
    r3_test = safe_rets(test_rows, "ret_3d")
    r5_test = safe_rets(test_rows, "ret_5d")
    r8_test = safe_rets(test_rows, "ret_8d")

    lr_quintiles = quintile_analysis(y_test, lr_result["prob_test"], comp_test, r1_test, r3_test, r5_test, r8_test)
    gbm_quintiles = quintile_analysis(y_test, gbm_result["prob_test"], comp_test, r1_test, r3_test, r5_test, r8_test) if gbm_result else None

    print("\n테스트셋 분위 분석 (로지스틱 회귀):")
    for q in lr_quintiles:
        print(f"  Q{q['quintile']}: prob={q['avg_prob']:.3f}  win={q['win_rate']:.1f}%  "
              f"comp={q['avg_comp_ret']:+.2f}%  T+1={q['avg_ret_1d']:+.2f}%  "
              f"T+3={q['avg_ret_3d']:+.2f}%  T+5={q['avg_ret_5d']:+.2f}%  T+8={q['avg_ret_8d']:+.2f}%")

    if gbm_quintiles:
        print("\n테스트셋 분위 분석 (LightGBM):")
        for q in gbm_quintiles:
            print(f"  Q{q['quintile']}: prob={q['avg_prob']:.3f}  win={q['win_rate']:.1f}%  "
                  f"comp={q['avg_comp_ret']:+.2f}%  T+1={q['avg_ret_1d']:+.2f}%  "
                  f"T+3={q['avg_ret_3d']:+.2f}%  T+5={q['avg_ret_5d']:+.2f}%  T+8={q['avg_ret_8d']:+.2f}%")

    best_model_name = "logistic"
    best_test_auc = lr_result["test_auc"]
    if gbm_result and gbm_result["test_auc"] > lr_result["test_auc"] + 0.01:
        best_model_name = "lightgbm"
        best_test_auc = gbm_result["test_auc"]
    print(f"\n채택 모델: {best_model_name} (Test AUC {best_test_auc})")

    print("\n전체 예측 생성...")
    X_all, y_all = make_arrays(rows, FEATURE_COLS)
    X_all_sel = X_all[:, sel_indices]

    if best_model_name == "logistic":
        X_all_s = lr_result["scaler"].transform(X_all_sel)
        probs_all = lr_result["model"].predict_proba(X_all_s)[:, 1]
    else:
        probs_all = gbm_result["model"].predict_proba(X_all_sel)[:, 1]

    scores_dict: dict[str, float] = {}
    for i, r in enumerate(rows):
        aid = r.get("article_id")
        if isinstance(aid, str) and aid:
            score = int(round(probs_all[i] * 100))
            score = max(0, min(100, score))
            scores_dict[aid] = score

    scores_json = {
        "generated_at": datetime.now().isoformat(),
        "source": f"quant_v2_{best_model_name}",
        "model": best_model_name,
        "test_auc": best_test_auc,
        "count": len(scores_dict),
        "scores": scores_dict,
    }
    OUT_SCORES.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_SCORES, "w", encoding="utf-8") as f:
        json.dump(scores_json, f, ensure_ascii=False, indent=2)
    print(f"점수 JSON 저장: {OUT_SCORES} ({len(scores_dict)}건)")

    model_json = {
        "generated_at": datetime.now().isoformat(),
        "selected_model": best_model_name,
        "n_train": len(train_rows),
        "n_test": len(test_rows),
        "label_definition": {
            "type": "composite_multi_horizon",
            "description": "가중 복합 수익률 > threshold → 우상향",
            "weights": COMPOSITE_WEIGHTS,
            "threshold_pct": COMPOSITE_THRESHOLD,
        },
        "selected_features": selected_features,
        "logistic": {
            "train_auc": lr_result["train_auc"],
            "test_auc": lr_result["test_auc"],
            "test_acc": lr_result["test_acc"],
            "test_brier": lr_result["test_brier"],
            "coefs": lr_result["coefs"],
            "intercept": lr_result["intercept"],
            "scaler_mean": lr_result["scaler_mean"],
            "scaler_scale": lr_result["scaler_scale"],
        },
    }
    if gbm_result:
        model_json["lightgbm"] = {
            "train_auc": gbm_result["train_auc"],
            "test_auc": gbm_result["test_auc"],
            "test_acc": gbm_result["test_acc"],
            "test_brier": gbm_result["test_brier"],
            "importances": gbm_result["importances"],
        }
    model_json["random_baseline_mc"] = {
        "description": "[0,1] uniform probs per row, metrics averaged over trials",
        **{k: random_bl[k] for k in ("train_auc", "test_auc", "test_acc", "test_brier", "n_trials", "seed")},
    }
    model_json["crash_risk"] = {
        "description": f"ret_1d < {CRASH_THRESHOLD}% 폭락 확률 (로지스틱, class_weight=balanced)",
        "threshold_pct": CRASH_THRESHOLD,
        "composite_threshold_pct": COMPOSITE_THRESHOLD,
        "crash_rate_train": crash_result["crash_rate_train"],
        "crash_rate_test": crash_result["crash_rate_test"],
        "train_auc": crash_result["train_auc"],
        "test_auc": crash_result["test_auc"],
        "coefs": crash_result["coefs"],
        "intercept": crash_result["intercept"],
        "scaler_mean": crash_result["scaler_mean"],
        "scaler_scale": crash_result["scaler_scale"],
    }
    with open(OUT_MODEL, "w", encoding="utf-8") as f:
        json.dump(model_json, f, ensure_ascii=False, indent=2)
    print(f"모델 JSON 저장: {OUT_MODEL}")

    report = generate_report(
        n_total, len(train_rows), len(test_rows),
        base_rate_train, base_rate_test,
        feat_analysis,
        lr_result,
        gbm_result,
        lr_quintiles,
        gbm_quintiles,
        selected_features,
        random_bl,
        crash_result,
    )
    OUT_EVAL.parent.mkdir(parents=True, exist_ok=True)
    OUT_EVAL.write_text(report, encoding="utf-8")
    print(f"평가 보고서 저장: {OUT_EVAL}")

    print("\n완료!")


if __name__ == "__main__":
    main()
