#!/usr/bin/env python3
"""Classify Korean news: tone (긍정/부정/중립), article type (FDA·임상 등), stock catalyst (호재/악재 등).

Requires: pip install google-genai python-dotenv (use project .venv).

Environment:
  GOOGLE_API_KEY or GEMINI_API_KEY — API key (never commit; use .env)
  GEMINI_MODEL — optional; 미설정 시 순서: flash-lite → 2.5-flash → gemini-3-flash-preview
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

from google import genai
from google.genai import types

_REPO_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from news_taxonomy import ARTICLE_TYPE_LABELS_KO
if load_dotenv:
    load_dotenv(_REPO_ROOT / ".env")
    load_dotenv(_REPO_ROOT / ".env.local", override=True)


def _default_model() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")


def _model_try_order(explicit: str | None) -> list[str]:
    """explicit / env 우선, 이후 Flash-Lite(부하 적음) → 2.5 Flash → Gemini 3 Flash."""
    candidates = [
        explicit,
        os.environ.get("GEMINI_MODEL"),
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-3-flash-preview",
    ]
    out: list[str] = []
    seen: set[str] = set()
    for m in candidates:
        if m and m.strip() and m not in seen:
            seen.add(m)
            out.append(m.strip())
    return out


def is_overload_error(exc: BaseException) -> bool:
    err_s = str(exc).upper()
    return any(
        x in err_s
        for x in (
            "503",
            "UNAVAILABLE",
            "429",
            "RESOURCE_EXHAUSTED",
            "RATE",
            "QUOTA",
            "DEADLINE",
        )
    )


def _classify_with_model(text: str, model_id: str, api_key: str) -> dict:
    client = genai.Client(api_key=api_key)
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        temperature=0.2,
        response_mime_type="application/json",
        response_schema=_NEWS_CLASSIFY_SCHEMA,
    )
    user_prompt = f"다음 뉴스 기사를 분류하세요.\n\n---\n{text.strip()}\n---"
    response = client.models.generate_content(
        model=model_id,
        contents=user_prompt,
        config=config,
    )
    return json.loads(response.text)


_TYPE_ENUM = list(ARTICLE_TYPE_LABELS_KO)

_NEWS_CLASSIFY_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "sentiment": types.Schema(
            type=types.Type.STRING,
            enum=["positive", "negative", "neutral"],
        ),
        "label_ko": types.Schema(
            type=types.Type.STRING,
            enum=["긍정", "부정", "중립"],
        ),
        "confidence": types.Schema(type=types.Type.NUMBER),
        "brief_reason": types.Schema(
            type=types.Type.STRING,
            description="감성 판단 근거, 한 문장 한국어.",
        ),
        "article_types_ko": types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(type=types.Type.STRING, enum=_TYPE_ENUM),
            description="해당되는 유형 전부(1~4개 권장). 애매하면 기타·미분류 포함.",
        ),
        "primary_type_ko": types.Schema(
            type=types.Type.STRING,
            enum=_TYPE_ENUM,
            description="가장 대표적인 단일 유형.",
        ),
        "stock_catalyst": types.Schema(
            type=types.Type.STRING,
            enum=["bullish", "bearish", "neutral_mixed", "not_applicable"],
            description="주가 관점 촉매: 호재/악재/중립·혼재/해당없음(순수 기획·랭킹 등).",
        ),
        "stock_catalyst_label_ko": types.Schema(
            type=types.Type.STRING,
            enum=["호재", "악재", "중립·혼재", "해당없음"],
        ),
        "type_brief_ko": types.Schema(
            type=types.Type.STRING,
            description="유형·호재 판단 근거, 한 문장 한국어.",
        ),
    },
    required=[
        "sentiment",
        "label_ko",
        "confidence",
        "brief_reason",
        "article_types_ko",
        "primary_type_ko",
        "stock_catalyst",
        "stock_catalyst_label_ko",
        "type_brief_ko",
    ],
)

SYSTEM_PROMPT = """You classify Korean biotech/equity news headlines and short excerpts.

1) Sentiment (tone of the writing toward the company or topic)
- positive/긍정, negative/부정, neutral/중립 — label_ko must match sentiment.
- brief_reason: one Korean sentence for sentiment.

2) Article types (use EXACT Korean labels from the enum only)
- Pick ALL that clearly apply (typically 1–4). Examples: FDA·미국규제 for FDA/NDA/BLA/US regulatory;
  임상·결과 for trials; 기술이전·수출·라이선스 for tech transfer/license; 실적·가이던스 for earnings;
  순위·기획·연재 for rankings/series/deep-dive columns; 시황·테마·주가코멘터리 for market/theme/price chatter.
- primary_type_ko: the single best main bucket.

3) Stock catalyst (for the mentioned stock(s), if any)
- bullish/호재: clear positive catalyst (approval, beat, major deal, strong clinical win).
- bearish/악재: clear negative (failure, lawsuit, delisting risk, bad trial).
- neutral_mixed/중립·혼재: factual, mixed, or weak signal.
- not_applicable/해당없음: no real price catalyst (pure listicle, profile, vague outlook).
- stock_catalyst_label_ko must match stock_catalyst.
- type_brief_ko: one Korean sentence for type + catalyst (can reference FDA etc.)."""


# 호환용 별칭
SENTIMENT_SCHEMA = _NEWS_CLASSIFY_SCHEMA


def classify_article(
    text: str,
    *,
    model: str | None = None,
    api_key: str | None = None,
) -> dict:
    key = api_key or os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not key:
        raise ValueError(
            "Set GOOGLE_API_KEY or GEMINI_API_KEY in the environment or a .env file at the repo root."
        )

    stripped = text.strip()
    if not stripped:
        raise ValueError("Empty text")

    last_err: BaseException | None = None
    for model_id in _model_try_order(model):
        # 모델당 과부하 시 짧게 2번만 재시도 후 다음 모델로 (같은 엔드포인트 연타 방지)
        for attempt in range(3):
            try:
                return _classify_with_model(stripped, model_id, key)
            except BaseException as exc:
                last_err = exc
                err_s = str(exc).upper()
                if "404" in err_s or "NOT_FOUND" in err_s:
                    break
                if is_overload_error(exc):
                    if attempt < 2:
                        delay = 18.0 + attempt * 28.0 + random.uniform(0, 14.0)
                        time.sleep(delay)
                        continue
                    break
                raise
    if last_err is not None:
        raise last_err
    raise RuntimeError("No Gemini model candidates")


def main() -> None:
    parser = argparse.ArgumentParser(description="Gemini: 뉴스 긍정/부정/중립 분류")
    parser.add_argument("text", nargs="?", help="기사 텍스트 (생략 시 stdin)")
    parser.add_argument(
        "--model",
        default=None,
        help="우선 시도할 모델 (실패 시 gemini-3-flash-preview 등으로 자동 폴백)",
    )
    args = parser.parse_args()

    body = args.text if args.text else sys.stdin.read()
    if not body.strip():
        print("기사 텍스트를 인자로 주거나 stdin으로 넣으세요.", file=sys.stderr)
        sys.exit(1)

    try:
        result = classify_article(body, model=args.model)
    except Exception as exc:
        print(exc, file=sys.stderr)
        sys.exit(2)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
