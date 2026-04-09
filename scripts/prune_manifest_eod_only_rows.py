#!/usr/bin/env python3
"""
매니페스트에서「일봉(EOD)만 있고 5분봉이 없는」행을 제거하고,
더 이상 어떤 행에서도 참조되지 않는 EOD JSON 파일을 삭제합니다.

앱은 EOD+5분이 함께 있는 행만 사용하도록 맞춰 두었으므로,
Firebase/로컬 데이터 정리 시 이 스크립트로 원천 데이터를 맞추면 됩니다.

  python3 scripts/prune_manifest_eod_only_rows.py
  python3 scripts/prune_manifest_eod_only_rows.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _norm_eod_path(p: str) -> str:
    s = (p or "").strip().replace("\\", "/")
    if not s:
        return ""
    if not s.startswith("per_article/"):
        return f"per_article/{s.removeprefix('per_article/')}"
    return s


def _row_is_eod_only(row: dict) -> bool:
    if not row.get("eod_ok"):
        return False
    intra_ok = row.get("intraday_ok") is True
    path = row.get("intraday_path") or ""
    return not intra_ok or not str(path).strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--manifest",
        type=Path,
        default=Path(__file__).resolve().parent.parent
        / "data"
        / "eodhd_news_windows"
        / "per_article"
        / "manifest_per_article.json",
        help="manifest_per_article.json 경로",
    )
    ap.add_argument(
        "--windows-root",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "data" / "eodhd_news_windows",
        help="eod_path 기준 루트 (로컬 파일 삭제용)",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    manifest_path: Path = args.manifest
    root: Path = args.windows_root

    if not manifest_path.is_file():
        print("매니페스트 없음:", manifest_path, file=sys.stderr)
        return 1

    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        print("매니페스트가 배열이 아닙니다.", file=sys.stderr)
        return 1

    rows: list[dict] = raw
    to_drop = [r for r in rows if _row_is_eod_only(r)]
    kept = [r for r in rows if not _row_is_eod_only(r)]

    ref_after = set()
    for r in kept:
        if r.get("eod_ok") and r.get("eod_path"):
            ref_after.add(_norm_eod_path(str(r["eod_path"])))

    orphan_files: list[Path] = []
    for r in to_drop:
        if not r.get("eod_ok") or not r.get("eod_path"):
            continue
        rel = _norm_eod_path(str(r["eod_path"]))
        if rel in ref_after:
            continue
        abs_path = root / rel
        if abs_path.is_file():
            orphan_files.append(abs_path)

    print(f"총 행: {len(rows)} → 유지 {len(kept)}, 제거(일봉만) {len(to_drop)}")
    print(f"삭제 후보 EOD 파일: {len(orphan_files)}개")

    if args.dry_run:
        if to_drop[:5]:
            print("제거 행 예시:", json.dumps(to_drop[:3], ensure_ascii=False, indent=2)[:800])
        return 0

    manifest_path.write_text(
        json.dumps(kept, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    for f in orphan_files:
        try:
            f.unlink()
            print("삭제:", f)
        except OSError as e:
            print("삭제 실패:", f, e, file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
