#!/usr/bin/env python3
"""
KRX 종목코드 → 종목명 매핑 생성 (pandas만 사용)
Run: python3 scripts/fetch_ticker_names.py
"""

import json
from pathlib import Path

import pandas as pd

OUTPUT = Path(__file__).resolve().parents[1] / "data" / "ticker_names.json"

KRX_URL = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13"


def main():
    try:
        dfs = pd.read_html(KRX_URL)
        df = dfs[0]
    except Exception as e:
        print(f"KRX 조회 실패: {e}")
        return
    if df.empty or "종목코드" not in df.columns or "회사명" not in df.columns:
        print("KRX 컬럼 형식 변경됨")
        return
    df["종목코드"] = df["종목코드"].astype(str).str.zfill(6)
    mapping = df.set_index("종목코드")["회사명"].to_dict()
    mapping = {k: str(v).strip() for k, v in mapping.items() if k.isdigit() and len(k) == 6}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    print(f"저장: {OUTPUT} ({len(mapping)}개)")
