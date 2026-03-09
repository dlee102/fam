#!/usr/bin/env python3
"""
팜이데일리 로그인 - 한 번 로그인 후 세션 저장
저장된 세션으로 크롤러 실행 시 Chrome 종료 불필요
"""

from pathlib import Path

AUTH_FILE = Path(__file__).parent / "pharm_auth.json"


def main():
    from playwright.sync_api import sync_playwright

    print("브라우저가 열립니다. 팜이데일리에서 구글 로그인을 완료하세요.")
    print("로그인 후 이 창으로 돌아와 Enter를 누르세요.\n")

    with sync_playwright() as p:
        # channel="chrome" → 실제 Chrome 사용 (구글 로그인 허용)
        browser = p.chromium.launch(channel="chrome", headless=False)
        context = browser.new_context()
        page = context.new_page()
        page.goto("https://pharm.edaily.co.kr/News/List_All?cd=PE00")
        input("로그인 완료 후 Enter...")
        context.storage_state(path=str(AUTH_FILE))
        browser.close()

    print(f"\n로그인 상태 저장 완료: {AUTH_FILE}")
    print("이제 pharm_crawler.py --playwright 로 실행하세요.")


if __name__ == "__main__":
    main()
