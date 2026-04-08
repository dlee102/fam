"""
퀀트 점수 재설계 분석
======================
발행일 기준 T+1 / T+2 양전 여부를 outcome으로 삼아,
발행 시점 직전 기술 지표를 비교 — 어떤 지표가 실제로 단기 양전을 구별하는지 검증.

결과 → scripts/redesign_quant_score.md
"""
import json, math, os, statistics
from pathlib import Path
from datetime import date, datetime, timezone, timedelta

BASE = Path("data/eodhd_news_windows/per_article")
MANIFEST = BASE / "manifest_per_article.json"
OUT_MD   = Path("scripts/redesign_quant_score.md")

KST = timezone(timedelta(hours=9))

# ── 5분봉 유틸 (entry_hold_analysis.py 동일 규칙) ─────────────────────
def is_market_bar(dt_str: str) -> bool:
    hm = dt_str[11:16]
    return "00:00" <= hm <= "06:25"

def session_bars(bars_5m: list, ymd: str) -> list:
    return sorted(
        [b for b in bars_5m if isinstance(b.get("datetime"), str)
         and b["datetime"][:10] == ymd and is_market_bar(b["datetime"])],
        key=lambda x: x["datetime"]
    )

def second_bar_open(bars_5m: list, ymd: str) -> float | None:
    d = session_bars(bars_5m, ymd)
    if len(d) < 2: return None
    v = float(d[1].get("open") or d[1].get("close") or 0)
    return v if v > 0 else None

def last_session_close(bars_5m: list, ymd: str) -> float | None:
    d = session_bars(bars_5m, ymd)
    if not d: return None
    v = float(d[-1].get("close") or d[-1].get("open") or 0)
    return v if v > 0 else None

# ── 지표 계산 ──────────────────────────────────────────────────────────
def sma(closes: list, n: int) -> float | None:
    if len(closes) < n: return None
    return sum(closes[-n:]) / n

def atr14(bars: list) -> float | None:
    if len(bars) < 15: return None
    trs = []
    for i in range(1, len(bars)):
        pc = bars[i-1]["close"]
        b  = bars[i]
        trs.append(max(b["high"]-b["low"], abs(b["high"]-pc), abs(b["low"]-pc)))
    atr = sum(trs[:14]) / 14
    for tr in trs[14:]:
        atr = (atr * 13 + tr) / 14
    return atr

def bb_pct_b(closes: list, n=20, mult=2) -> float | None:
    if len(closes) < n: return None
    sl = closes[-n:]
    mid = sum(sl)/n
    std = math.sqrt(sum((x-mid)**2 for x in sl)/n)
    if std == 0: return 0.5
    up = mid + mult*std; lo = mid - mult*std
    if up == lo: return 0.5
    return (closes[-1] - lo) / (up - lo)

def rsi14(closes: list) -> float | None:
    if len(closes) < 15: return None
    ch = [closes[i]-closes[i-1] for i in range(1, len(closes))]
    ag = sum(c for c in ch[:14] if c>0)/14
    al = sum(-c for c in ch[:14] if c<0)/14
    for c in ch[14:]:
        ag = (ag*13 + (c if c>0 else 0)) / 14
        al = (al*13 + (-c if c<0 else 0)) / 14
    if al == 0: return 100.0
    return 100 - 100/(1 + ag/al)

def mom10(closes: list) -> float | None:
    if len(closes) <= 10: return None
    past = closes[-11]; cur = closes[-1]
    if past == 0: return None
    return (cur/past - 1)*100

def compute_indicators(bars: list) -> dict:
    closes = [b["close"] for b in bars]
    volumes= [b.get("volume", 0) for b in bars]
    ma5  = sma(closes, 5)
    ma20 = sma(closes, 20)
    spread = (ma5-ma20)/ma20*100 if ma5 and ma20 and ma20!=0 else None
    _atr = atr14(bars)
    atr_r = (_atr/ma20*100) if _atr and ma20 and ma20!=0 else None
    _bb  = bb_pct_b(closes)
    _rsi = rsi14(closes)
    _mom = mom10(closes)
    # 거래량 비율
    if len(volumes) >= 21:
        avg = sum(volumes[-21:-1])/20
        vol_r = volumes[-1]/avg if avg>0 else None
    else:
        vol_r = None
    # 가격 레벨 (절대값은 의미 없어서 log scale)
    log_price = math.log(closes[-1]) if closes[-1] > 0 else None
    return dict(spread=spread, atr_r=atr_r, bb_pct_b=_bb,
                rsi=_rsi, mom10=_mom, vol_r=vol_r, log_price=log_price,
                close=closes[-1], ma20=ma20)

# ── 메인 루프 ──────────────────────────────────────────────────────────
manifest = json.loads(MANIFEST.read_text())
ok_rows  = [r for r in manifest if r.get("eod_ok") and r.get("intraday_ok")]

print(f"[분석 대상] {len(ok_rows)}건 (eod_ok + intraday_ok)")

records = []
skip_no_eod = skip_no_intra = skip_no_t0 = skip_no_entry = skip_no_close = 0

for row in ok_rows:
    eod_path   = BASE / row["eod_path"].replace("per_article/","")
    intra_path = BASE / row["intraday_path"].replace("per_article/","")
    if not eod_path.exists():   skip_no_eod   += 1; continue
    if not intra_path.exists(): skip_no_intra += 1; continue

    eod_data   = json.loads(eod_path.read_text())
    intra_data = json.loads(intra_path.read_text())
    eod_bars   = eod_data.get("bars", [])
    intra_bars = intra_data.get("bars", [])
    t0 = row["t0_kst"]                    # YYYY-MM-DD

    # T0 인덱스
    i0 = next((i for i,b in enumerate(eod_bars) if b["date"] >= t0), None)
    if i0 is None or i0 == 0:
        skip_no_t0 += 1; continue
    # T0~T+2 EOD 슬라이스
    post = eod_bars[i0:i0+3]
    if len(post) < 2:
        skip_no_t0 += 1; continue

    anchor_price = eod_bars[i0-1]["close"]
    if not anchor_price: skip_no_t0 += 1; continue

    t0d = eod_bars[i0]["date"]
    t1d = post[1]["date"] if len(post) > 1 else None
    t2d = post[2]["date"] if len(post) > 2 else None

    # 일봉 수익률 (앵커 = i0-1 종가)
    ret_t0 = (post[0]["close"]/anchor_price - 1)*100
    ret_t1 = (post[1]["close"]/anchor_price - 1)*100 if t1d else None
    ret_t2 = (post[2]["close"]/anchor_price - 1)*100 if t2d else None

    # 진입 기준 수익률: T+1 두 번째 5분봉 시가 → T+1 장종 / T+2 장종
    entry_px = second_bar_open(intra_bars, t1d) if t1d else None
    cl_t1_intra = last_session_close(intra_bars, t1d) if t1d else None
    cl_t2_intra = last_session_close(intra_bars, t2d) if t2d else None

    if entry_px is None:
        skip_no_entry += 1

    ret_entry_t1 = (cl_t1_intra/entry_px - 1)*100 if (entry_px and cl_t1_intra) else None
    ret_entry_t2 = (cl_t2_intra/entry_px - 1)*100 if (entry_px and cl_t2_intra) else None

    # 발행 전 지표: published_at 직전까지 5분봉 집계 종가를 포함한 일봉 slice
    # 단순화: eod_bars[:i0] 전부 사용 (T0 당일은 제외, 발행 직전 상태)
    pre_bars = eod_bars[:i0]
    if len(pre_bars) < 15:
        skip_no_close += 1; continue

    ind = compute_indicators(pre_bars)
    if any(v is None for v in [ind["spread"], ind["atr_r"], ind["bb_pct_b"], ind["rsi"], ind["mom10"]]):
        skip_no_close += 1; continue

    records.append(dict(
        article_id=row["article_id"], ticker=row["ticker"], t0=t0,
        ret_t0=ret_t0, ret_t1=ret_t1, ret_t2=ret_t2,
        ret_entry_t1=ret_entry_t1, ret_entry_t2=ret_entry_t2,
        **{f"ind_{k}": v for k,v in ind.items()}
    ))

print(f"  → 유효 레코드: {len(records)}건")
print(f"  skip: no_eod={skip_no_eod}, no_intra={skip_no_intra}, no_t0={skip_no_t0}, no_entry={skip_no_entry}, no_close={skip_no_close}")

# ── outcome 분류 ───────────────────────────────────────────────────────
def label_outcome(rec: dict) -> str:
    # 진입 기준(있으면) 우선, 없으면 일봉 기준
    r1 = rec.get("ret_entry_t1") if rec.get("ret_entry_t1") is not None else rec.get("ret_t1")
    r2 = rec.get("ret_entry_t2") if rec.get("ret_entry_t2") is not None else rec.get("ret_t2")
    if r1 is None: r1 = 0.0
    if r2 is None: r2 = 0.0
    best = max(r1, r2)
    if best >= 2.0:  return "WIN"    # T+1 또는 T+2 중 하나라도 +2% 이상
    if best <= -2.0: return "LOSS"   # 둘 다 -2% 이하
    return "FLAT"

for rec in records:
    rec["outcome"] = label_outcome(rec)

win  = [r for r in records if r["outcome"] == "WIN"]
loss = [r for r in records if r["outcome"] == "LOSS"]
flat = [r for r in records if r["outcome"] == "FLAT"]
print(f"\n[Outcome] WIN={len(win)}, LOSS={len(loss)}, FLAT={len(flat)}")

# ── 지표별 평균 비교 ───────────────────────────────────────────────────
INDICATORS = ["ind_spread", "ind_atr_r", "ind_bb_pct_b", "ind_rsi", "ind_mom10", "ind_vol_r"]
IND_LABELS = {
    "ind_spread":   "MA5-20 이격(%)",
    "ind_atr_r":    "ATR 비율(%)",
    "ind_bb_pct_b": "BB %B",
    "ind_rsi":      "RSI 14",
    "ind_mom10":    "10일 모멘텀(%)",
    "ind_vol_r":    "거래량 비율",
}

def grp_stats(recs: list, key: str) -> dict:
    vals = [r[key] for r in recs if r.get(key) is not None]
    if not vals: return dict(n=0, mean=None, med=None, std=None)
    m = sum(vals)/len(vals)
    med = statistics.median(vals)
    std = statistics.stdev(vals) if len(vals) > 1 else 0
    return dict(n=len(vals), mean=m, med=med, std=std)

rows_stats = []
for key in INDICATORS:
    w = grp_stats(win, key)
    l = grp_stats(loss, key)
    f = grp_stats(flat, key)
    rows_stats.append((key, w, l, f))

# ── 이진 분류 정밀도 (Mann-Whitney 근사 AUC) ─────────────────────────
def rank_auc(pos_vals: list, neg_vals: list) -> float:
    """비모수 AUC ≈ P(pos > neg)."""
    if not pos_vals or not neg_vals: return 0.5
    n1, n2 = len(pos_vals), len(neg_vals)
    wins = sum(1 for a in pos_vals for b in neg_vals if a < b)  # 낮을수록 유리인 경우 뒤집힘
    return wins / (n1 * n2)

def rank_auc_dir(pos_vals: list, neg_vals: list, lower_is_better: bool) -> float:
    if not pos_vals or not neg_vals: return 0.5
    n1, n2 = len(pos_vals), len(neg_vals)
    if lower_is_better:
        wins = sum(1 for a in pos_vals for b in neg_vals if a < b)
    else:
        wins = sum(1 for a in pos_vals for b in neg_vals if a > b)
    return wins / (n1 * n2)

# 낮을수록 WIN 유리한 지표
LOWER_IS_BETTER = {"ind_spread": True, "ind_atr_r": True, "ind_bb_pct_b": True,
                   "ind_rsi": True, "ind_mom10": True, "ind_vol_r": False}

def safe_vals(recs, key):
    return [r[key] for r in recs if r.get(key) is not None]

auc_rows = []
for key in INDICATORS:
    wv = safe_vals(win, key)
    lv = safe_vals(loss, key)
    auc_wl = rank_auc_dir(wv, lv, LOWER_IS_BETTER.get(key, True))
    auc_rows.append((key, auc_wl))

# ── 수익률 백분위 비교 ─────────────────────────────────────────────────
def pct(lst, q): 
    if not lst: return None
    s = sorted(lst)
    idx = max(0, min(len(s)-1, int(q/100*(len(s)-1))))
    return s[idx]

ret_key = "ret_entry_t1"  # 진입 기준 T+1 수익률
ret_all = [r[ret_key] for r in records if r.get(ret_key) is not None]
ret_win = [r[ret_key] for r in win if r.get(ret_key) is not None]
ret_loss= [r[ret_key] for r in loss if r.get(ret_key) is not None]

# ── 점수 재설계 제안 ───────────────────────────────────────────────────
# AUC 기반 가중치 재배분 (AUC 0.5=무의미, 1.0=완벽)
auc_dict = dict(auc_rows)
# 유효 AUC: |AUC - 0.5|
effective = {k: abs(v-0.5) for k,v in auc_dict.items()}
total_eff = sum(effective.values()) or 1
new_weights = {k: round(v/total_eff*100) for k,v in effective.items()}

# ── Markdown 출력 ──────────────────────────────────────────────────────
def fmt(v, dec=2):
    return f"{v:.{dec}f}" if v is not None else "—"

lines = [
    "# 퀀트 점수 재설계 분석 보고서",
    f"\n생성: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
    f"\n## 1. 분석 대상",
    f"- 유효 샘플: **{len(records)}건** (EOD + 5분봉 모두 있는 기사-종목 페어)",
    f"- 데이터 범위: `data/eodhd_news_windows/per_article`",
    "",
    f"## 2. Outcome 분류 (진입 기준 — 없으면 일봉 앵커)",
    f"| 구분 | 건수 | 비율 |",
    f"|------|------|------|",
    f"| WIN (+2% 이상, T+1 또는 T+2 중 최고) | {len(win)} | {len(win)/len(records)*100:.1f}% |",
    f"| FLAT (-2% ~ +2%) | {len(flat)} | {len(flat)/len(records)*100:.1f}% |",
    f"| LOSS (-2% 이하) | {len(loss)} | {len(loss)/len(records)*100:.1f}% |",
    "",
    f"### 진입 기준 T+1 수익률 분포 (전체)",
]
if ret_all:
    lines += [
        f"- 평균: **{fmt(sum(ret_all)/len(ret_all))}%** (N={len(ret_all)})",
        f"- 중앙값: {fmt(statistics.median(ret_all))}%",
        f"- P10/P25/P75/P90: {fmt(pct(ret_all,10))} / {fmt(pct(ret_all,25))} / {fmt(pct(ret_all,75))} / {fmt(pct(ret_all,90))}",
    ]

lines += [
    "",
    "## 3. 지표별 WIN vs LOSS 평균 비교",
    "| 지표 | WIN 평균 | WIN 중앙값 | LOSS 평균 | LOSS 중앙값 | AUC(WIN↑) | 기존 가중 |",
    "|------|----------|------------|-----------|-------------|-----------|-----------|",
]
old_weights = {"ind_spread":35,"ind_atr_r":25,"ind_bb_pct_b":20,"ind_rsi":10,"ind_mom10":10,"ind_vol_r":0}
for key, w, l, f in rows_stats:
    auc_v = auc_dict.get(key, 0.5)
    lines.append(
        f"| {IND_LABELS[key]} "
        f"| {fmt(w['mean'])} (n={w['n']}) "
        f"| {fmt(w['med'])} "
        f"| {fmt(l['mean'])} (n={l['n']}) "
        f"| {fmt(l['med'])} "
        f"| {auc_v:.3f} "
        f"| {old_weights.get(key,0)} |"
    )

lines += [
    "",
    "## 4. AUC 기반 신규 가중치 제안",
    "AUC(WIN↑): P(WIN 그룹이 유리한 방향) — 0.5=무의미, 1.0=완벽 분리",
    "| 지표 | |AUC-0.5| | 기존 가중치 | 제안 가중치 |",
    "|------|-----------|-----------|-------------|",
]
for key in INDICATORS:
    eff = effective.get(key, 0)
    old = old_weights.get(key, 0)
    new = new_weights.get(key, 0)
    lines.append(f"| {IND_LABELS[key]} | {eff:.4f} | {old} | **{new}** |")

lines += [
    "",
    "## 5. 지표별 점수 산출 방향 재정의",
    "",
    "### MA5-20 이격(%)",
    f"- WIN 중앙값: {fmt(grp_stats(win, 'ind_spread')['med'])}% vs LOSS 중앙값: {fmt(grp_stats(loss, 'ind_spread')['med'])}%",
    "- **해석**: 이격이 작거나 음수(단기 눌림)일수록 WIN 경향. 기존 방향 유지.",
    "",
    "### ATR 비율(%)",
    f"- WIN 중앙값: {fmt(grp_stats(win, 'ind_atr_r')['med'])}% vs LOSS 중앙값: {fmt(grp_stats(loss, 'ind_atr_r')['med'])}%",
    "- **해석**: 변동성 응축(낮은 ATR)이 유리하면 기존 방향 유지. 역전 시 재조정 필요.",
    "",
    "### BB %B",
    f"- WIN 중앙값: {fmt(grp_stats(win, 'ind_bb_pct_b')['med'])} vs LOSS 중앙값: {fmt(grp_stats(loss, 'ind_bb_pct_b')['med'])}",
    "- **해석**: 0 근처(하단 부근)일수록 WIN 경향이면 기존 방향 유지.",
    "",
    "### RSI 14",
    f"- WIN 중앙값: {fmt(grp_stats(win, 'ind_rsi')['med'])} vs LOSS 중앙값: {fmt(grp_stats(loss, 'ind_rsi')['med'])}",
    "- **해석**: 35 미만 과매도 → WIN 경향이면 기존 방향(낮을수록 유리) 유지.",
    "",
    "### 10일 모멘텀(%)",
    f"- WIN 중앙값: {fmt(grp_stats(win, 'ind_mom10')['med'])}% vs LOSS 중앙값: {fmt(grp_stats(loss, 'ind_mom10')['med'])}%",
    "- **해석**: 사전 하락(역발상) vs 사전 급등. 방향 확인.",
    "",
    "### 거래량 비율",
    f"- WIN 중앙값: {fmt(grp_stats(win, 'ind_vol_r')['med'])} vs LOSS 중앙값: {fmt(grp_stats(loss, 'ind_vol_r')['med'])}",
    "- **해석**: 기존에는 미사용. AUC 높으면 추가 필요.",
    "",
    "## 6. 핵심 발견 & 개선 권고",
    "",
]

# 방향 분석
for key, w, l, f in rows_stats:
    wm = w["med"]; lm = l["med"]
    auc_v = auc_dict.get(key, 0.5)
    if wm is None or lm is None:
        continue
    diff = wm - lm
    direction = "WIN < LOSS (낮을수록 유리, 기존 방향 ✓)" if diff < 0 else "WIN > LOSS (높을수록 유리 ← 방향 반전?)"
    lines.append(f"- **{IND_LABELS[key]}**: 중앙값 차이 {diff:+.2f} — {direction} (AUC={auc_v:.3f})")

lines += [
    "",
    "---",
    "*이 보고서는 scripts/redesign_quant_score.py 로 자동 생성됩니다.*"
]

OUT_MD.write_text("\n".join(lines), encoding="utf-8")
print(f"\n✅ 보고서 저장: {OUT_MD}")

# 콘솔 요약
print("\n── 지표별 WIN vs LOSS 중앙값 ──────────────────────────")
for key, w, l, f in rows_stats:
    auc_v = auc_dict.get(key, 0.5)
    print(f"  {IND_LABELS[key]:20s}  WIN={fmt(w['med'],2):8s}  LOSS={fmt(l['med'],2):8s}  AUC={auc_v:.3f}")

print("\n── AUC 기반 제안 가중치 ────────────────────────────────")
for key in INDICATORS:
    print(f"  {IND_LABELS[key]:20s}  기존={old_weights.get(key,0):3d}  제안={new_weights.get(key,0):3d}")
