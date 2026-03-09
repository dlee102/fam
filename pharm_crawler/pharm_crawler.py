#!/usr/bin/env python3
"""
팜이데일리 크롤러 - pharm_auth.json 쿠키 사용 (우회, 브라우저 불필요)
https://pharm.edaily.co.kr/News/List_All?cd=PE00

python pharm_login.py 로그인 → python pharm_crawler.py --cookies
"""

import json
import random
import re
import time
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

LIST_URL = "https://pharm.edaily.co.kr/News/List_All?cd=PE00"
ARTICLE_URL_PATTERN = re.compile(r"/News/Read\?newsId=(\d+)&mediaCodeNo=257")
AUTH_FILE = Path(__file__).parent / "pharm_auth.json"
COOKIES_FILE = Path(__file__).parent / "pharm_cookies.txt"

CHROME_USER_DATA = Path.home() / "Library/Application Support/Google/Chrome"
CHROME_PROFILE = "Default"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    "Referer": "https://pharm.edaily.co.kr/",
}


# --- requests + pharm_auth.json 쿠키 (우회, 브라우저 불필요) ---


def load_cookies_from_auth() -> str:
    """pharm_auth.json에서 쿠키 추출 → Cookie 헤더 문자열."""
    with open(AUTH_FILE, encoding="utf-8") as f:
        data = json.load(f)
    parts = []
    for c in data.get("cookies", []):
        domain = c.get("domain", "")
        if "edaily.co.kr" in domain or "pharm.edaily.co.kr" in domain:
            parts.append(f"{c['name']}={c['value']}")
    return "; ".join(parts)


def run_cookies(max_articles: int, output: Path) -> None:
    """pharm_auth.json 쿠키로 requests로 크롤링 (브라우저 없음)."""
    if not AUTH_FILE.exists():
        print("pharm_auth.json 없음. python pharm_login.py 실행 후 로그인하세요.")
        return

    cookie_header = load_cookies_from_auth()
    session = requests.Session()
    session.headers.update(HEADERS)
    session.headers["Cookie"] = cookie_header

    print("목록 페이지 수집 중...")
    resp = session.get(LIST_URL, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    seen: set[str] = set()
    for a in soup.select('a[href*="/News/Read?newsId="]'):
        href = a.get("href", "")
        if "mediaCodeNo=257" in href:
            m = ARTICLE_URL_PATTERN.search(href)
            if m:
                seen.add(m.group(1))

    urls = [
        f"https://pharm.edaily.co.kr/News/Read?newsId={nid}&mediaCodeNo=257"
        for nid in seen
    ][:max_articles]
    print(f"수집된 URL: {len(urls)}개")

    results = []
    for i, url in enumerate(urls, 1):
        print(f"[{i}/{len(urls)}] {url}")
        article = extract_article_requests(session, url)
        results.append(article)
        if article.get("premium_blocked"):
            print("  → 프리미엄 차단됨")
        elif article.get("body"):
            print(f"  → 본문 {len(article['body'])}자 수집")
        time.sleep(1)

    with open(output, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n저장 완료: {output}")


def extract_article_requests(session: requests.Session, url: str) -> dict:
    """requests로 기사 페이지 fetch 후 파싱."""
    resp = session.get(url, timeout=15)
    resp.raise_for_status()
    html = resp.text
    soup = BeautifulSoup(html, "html.parser")

    title = None
    body = None
    date_str = None

    for sel in [".newsnewtitle", "h1", ".article-title", ".news-title"]:
        el = soup.select_one(sel)
        if el:
            t = el.get_text(strip=True)
            if t and len(t) > 5 and "팜이데일리" not in t:
                title = t
                break

    for sel in [
        ".newsbody",
        ".newsbody.noprint",
        ".article-body",
        ".news-content",
        ".article-content",
        ".contents",
        "#articleBody",
        ".news_view",
        "[class*='article'] [class*='body']",
    ]:
        el = soup.select_one(sel)
        if el:
            t = el.get_text(strip=True)
            if t and len(t) > 100 and "구독" not in t[:50]:
                body = t
                break

    el = soup.select_one(".newsdate li, time, .date, [class*='date']")
    if el:
        date_str = el.get_text(strip=True)

    blocked = body is None and "이 기사는 유료 구독자를 위한 프리미엄 콘텐츠입니다" in html
    return {
        "url": url,
        "title": title,
        "body": body,
        "date": date_str,
        "author": None,
        "premium_blocked": blocked,
    }


# --- Playwright (쿠키 주입) ---


def parse_article_date(date_str: str | None) -> datetime | None:
    """기사 날짜 파싱. '등록 2026-03-04 오전 8:30:04' 형태."""
    if not date_str:
        return None
    for part in date_str.replace("\n", " ").split():
        if re.match(r"\d{4}-\d{2}-\d{2}", part):
            try:
                return datetime.strptime(part, "%Y-%m-%d")
            except ValueError:
                pass
    return None


def run_playwright_with_cookies(
    max_articles: int,
    output: Path,
    headless: bool,
    debug: bool = False,
    start_date: str | None = None,
    end_date: str | None = None,
    delay: float = 3.0,
    max_scrolls: int = 3,
) -> None:
    """pharm_auth.json 쿠키를 Playwright context에 주입."""
    from playwright.sync_api import sync_playwright

    if not AUTH_FILE.exists():
        print("pharm_auth.json 없음.")
        return

    with open(AUTH_FILE, encoding="utf-8") as f:
        data = json.load(f)

    cookies_playwright = []
    for c in data.get("cookies", []):
        domain = c.get("domain", "")
        if "edaily" in domain:
            cookies_playwright.append({
                "name": c["name"],
                "value": c["value"],
                "domain": domain,
                "path": c.get("path", "/"),
            })

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=headless)
        context = browser.new_context()
        context.add_cookies(cookies_playwright)
        page = context.new_page()

        try:
            print("목록 페이지 수집 중...")
            page.goto(LIST_URL)
            page.wait_for_load_state("domcontentloaded", timeout=10000)
            time.sleep(1)

            seen: set[str] = set()
            for _ in range(max_scrolls):
                for a in page.locator('a[href*="/News/Read?newsId="]').all():
                    href = a.get_attribute("href")
                    if href and "mediaCodeNo=257" in href:
                        m = ARTICLE_URL_PATTERN.search(href)
                        if m:
                            seen.add(m.group(1))
                try:
                    page.click("text=더보기", timeout=2000)
                    time.sleep(1.5 + random.uniform(0, 1))
                except Exception:
                    break

            urls = [
                f"https://pharm.edaily.co.kr/News/Read?newsId={nid}&mediaCodeNo=257"
                for nid in seen
            ]
            if max_articles > 0 and not (start_date or end_date):
                urls = urls[:max_articles]
            print(f"수집된 URL: {len(urls)}개 (delay={delay:.1f}s, scrolls={max_scrolls})")

            dt_start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
            dt_end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else None

            results = []
            for i, url in enumerate(urls, 1):
                print(f"[{i}/{len(urls)}] {url}")
                article = extract_article_playwright(page, url, debug=debug)
                if dt_start or dt_end:
                    ad = parse_article_date(article.get("date"))
                    if ad:
                        if dt_start and ad < dt_start:
                            print("  → 날짜 범위 밖, 스킵")
                            continue
                        if dt_end and ad > dt_end:
                            print("  → 날짜 범위 밖, 스킵")
                            continue
                results.append(article)
                if article.get("premium_blocked"):
                    print("  → 프리미엄 차단됨")
                elif article.get("body"):
                    print(f"  → 본문 {len(article['body'])}자 수집")
                jitter = random.uniform(0.5, 1.5)
                time.sleep(delay + jitter)

                if len(results) % 10 == 0 and len(results) > 0:
                    with open(output, "w", encoding="utf-8") as f:
                        json.dump(results, f, ensure_ascii=False, indent=2)
                    print(f"  → 중간 저장 ({len(results)}개)")

            with open(output, "w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"\n저장 완료: {output} ({len(results)}개)")

        finally:
            browser.close()


def run_playwright(urls: list[str], max_articles: int, output: Path, headless: bool) -> None:
    """Playwright로 크롤링. pharm_login.py로 저장한 세션 사용."""
    from playwright.sync_api import sync_playwright

    if not AUTH_FILE.exists():
        print("로그인 상태가 없습니다. 먼저 실행하세요: python pharm_login.py")
        return

    with sync_playwright() as p:
        # channel="chrome" → 실제 Chrome 사용 (구글 로그인 세션 유지)
        browser = p.chromium.launch(channel="chrome", headless=headless)
        context = browser.new_context(storage_state=str(AUTH_FILE))
        page = context.new_page()

        try:
            print("목록 페이지에서 기사 URL 수집 중...")
            page.goto(LIST_URL)
            page.wait_for_load_state("networkidle", timeout=10000)

            seen: set[str] = set()
            for _ in range(3):
                links = page.locator('a[href*="/News/Read?newsId="]').all()
                for a in links:
                    href = a.get_attribute("href")
                    if href and "mediaCodeNo=257" in href:
                        m = ARTICLE_URL_PATTERN.search(href)
                        if m:
                            seen.add(m.group(1))
                try:
                    page.click("text=더보기", timeout=2000)
                    time.sleep(1.5)
                except Exception:
                    break

            urls = [
                f"https://pharm.edaily.co.kr/News/Read?newsId={nid}&mediaCodeNo=257"
                for nid in seen
            ][:max_articles]
            print(f"수집된 URL: {len(urls)}개")

            results = []
            for i, url in enumerate(urls, 1):
                print(f"[{i}/{len(urls)}] {url}")
                article = extract_article_playwright(page, url)
                results.append(article)
                if article.get("premium_blocked"):
                    print("  → 프리미엄 차단됨 (로그인 확인)")
                elif article.get("body"):
                    print(f"  → 본문 {len(article['body'])}자 수집")
                time.sleep(1)

            with open(output, "w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"\n저장 완료: {output}")

        finally:
            browser.close()


def extract_article_playwright(page, url: str, debug: bool = False) -> dict:
    """Playwright page로 기사 추출. .newsbody가 팜이데일리 본문."""
    page.goto(url)
    time.sleep(2)  # JS 로딩 대기
    html = page.content()
    if debug:
        Path("debug_article.html").write_text(html, encoding="utf-8")
        print("  → debug_article.html 저장됨")

    title = None
    body = None
    date_str = None

    for sel in [".newsnewtitle", "h1", ".article-title", ".news-title"]:
        try:
            loc = page.locator(sel)
            if loc.count() > 0:
                t = loc.first.inner_text().strip()
                if t and len(t) > 5 and "팜이데일리" not in t:
                    title = t
                    break
        except Exception:
            continue

    # 팜이데일리 본문: .newsbody.noprint (로그인 시 전체 기사)
    for sel in [
        ".newsbody",
        ".newsbody.noprint",
        ".article-body",
        ".news-content",
        ".article-content",
        ".contents",
        "#articleBody",
        ".news_view",
    ]:
        try:
            loc = page.locator(sel)
            if loc.count() > 0:
                t = loc.first.inner_text().strip()
                if t and len(t) > 100 and "구독" not in t[:50]:
                    body = t
                    break
        except Exception:
            continue

    try:
        date_loc = page.locator(".newsdate li, time, .date, [class*='date']")
        if date_loc.count() > 0:
            date_str = date_loc.first.inner_text().strip()
    except Exception:
        pass

    # "유료 구독자를 위한" = 차단 메시지. .newsbody에 본문 있으면 로그인 성공
    blocked = body is None and "이 기사는 유료 구독자를 위한 프리미엄 콘텐츠입니다" in html
    return {
        "url": url,
        "title": title,
        "body": body,
        "date": date_str,
        "author": None,
        "premium_blocked": blocked,
    }


# --- Selenium (Chrome 프로필 - Chrome 종료 필요) ---


def create_driver(use_profile: bool = True, headless: bool = False):
    """Chrome 드라이버 생성."""
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    options = Options()
    if use_profile and CHROME_USER_DATA.exists():
        options.add_argument(f"--user-data-dir={CHROME_USER_DATA}")
        options.add_argument(f"--profile-directory={CHROME_PROFILE}")
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument(
        "user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    )

    try:
        from webdriver_manager.chrome import ChromeDriverManager
        service = Service(ChromeDriverManager().install())
        return webdriver.Chrome(service=service, options=options)
    except Exception as e:
        print(f"Chrome 드라이버 실패: {e}")
        print("→ python pharm_login.py 후 --playwright 사용 권장")
        raise


def get_article_urls_from_list(driver, list_url: str, max_scrolls: int = 3) -> list[str]:
    """목록 페이지에서 기사 URL 수집. '더보기' 클릭으로 추가 로드."""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    driver.get(list_url)
    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "a")))

    seen: set[str] = set()
    scroll_count = 0

    while scroll_count < max_scrolls:
        # 현재 페이지의 기사 링크 수집
        links = driver.find_elements(By.CSS_SELECTOR, 'a[href*="/News/Read?newsId="]')
        for a in links:
            href = a.get_attribute("href")
            if href and "mediaCodeNo=257" in href:
                m = ARTICLE_URL_PATTERN.search(href)
                if m:
                    news_id = m.group(1)
                    seen.add(news_id)

        # '더보기' 버튼 클릭
        try:
            from selenium.webdriver.common.by import By
            more_btn = driver.find_element(
                By.XPATH, "//a[contains(text(),'더보기')] | //*[contains(@onclick,'GetNewsList')]"
            )
            driver.execute_script("arguments[0].click();", more_btn)
            time.sleep(1.5)
            scroll_count += 1
        except Exception:
            break

    # 중복 제거 후 반환
    return [
        f"https://pharm.edaily.co.kr/News/Read?newsId={nid}&mediaCodeNo=257"
        for nid in seen
    ]


def extract_article(driver, url: str) -> dict | None:
    """기사 페이지에서 제목, 본문, 날짜 등 추출 (Selenium)."""
    from selenium.webdriver.common.by import By

    driver.get(url)
    time.sleep(1)

    html = driver.page_source
    title = None
    body = None
    date_str = None
    author = None

    # 제목
    for sel in ["h1", ".article-title", ".news-title", "[class*='title']"]:
        try:
            el = driver.find_element(By.CSS_SELECTOR, sel)
            t = el.text.strip()
            if t and len(t) > 5 and "팜이데일리" not in t:
                title = t
                break
        except Exception:
            continue

    for sel in [
        ".newsbody",
        ".newsbody.noprint",
        ".article-body",
        ".news-content",
        ".article-content",
        ".contents",
        "#articleBody",
        "[class*='article'] [class*='body']",
        ".news_view",
    ]:
        try:
            el = driver.find_element(By.CSS_SELECTOR, sel)
            t = el.text.strip()
            if t and len(t) > 100 and "구독" not in t[:50]:
                body = t
                break
        except Exception:
            continue

    # 날짜
    try:
        date_el = driver.find_element(By.CSS_SELECTOR, "time, .date, [class*='date']")
        date_str = date_el.text.strip()
    except Exception:
        pass

    blocked = body is None and "이 기사는 유료 구독자를 위한 프리미엄 콘텐츠입니다" in html
    return {
        "url": url,
        "title": title,
        "body": body,
        "date": date_str,
        "author": author,
        "premium_blocked": blocked,
    }


def main():
    import argparse

    parser = argparse.ArgumentParser(description="팜이데일리 프리미엄 기사 크롤러")
    parser.add_argument("--cookies", action="store_true", help="pharm_auth.json 쿠키로 requests 사용")
    parser.add_argument("--pw", action="store_true", help="Playwright + 쿠키 주입 (권장)")
    parser.add_argument("--playwright", action="store_true", help="Playwright storage_state 사용")
    parser.add_argument("--login", action="store_true", help="로그인 후 세션 저장 (pharm_login.py 실행)")
    parser.add_argument("--no-profile", action="store_true", help="Chrome 프로필 미사용 (비로그인)")
    parser.add_argument("--headless", action="store_true", help="브라우저 숨김")
    parser.add_argument("--max-articles", type=int, default=5, help="수집할 기사 수 (0=무제한, 날짜범위 시)")
    parser.add_argument("--start-date", default=None, help="시작일 (YYYY-MM-DD), 지정 시 날짜범위 크롤")
    parser.add_argument("--end-date", default=None, help="종료일 (기본: 오늘)")
    parser.add_argument("--delay", type=float, default=3.0, help="요청 간 대기 초 (기본 3, 봇 차단 방지)")
    parser.add_argument("--scrolls", type=int, default=5, help="더보기 클릭 횟수 (날짜범위 크롤 시 30~50 권장)")
    parser.add_argument("--output", "-o", default="pharm_articles.json", help="출력 파일")
    parser.add_argument("--debug", action="store_true", help="디버그: HTML 저장")
    args = parser.parse_args()

    if args.end_date is None and args.start_date:
        args.end_date = datetime.now().strftime("%Y-%m-%d")
    if args.start_date and args.max_articles == 5:
        args.max_articles = 0
        args.scrolls = max(args.scrolls, 30)

    out_path = Path(args.output)

    if args.login:
        from pharm_login import main as login_main
        login_main()
        return

    # 우회: Playwright + 쿠키 주입
    if args.pw or (AUTH_FILE.exists() and not args.playwright and not args.cookies and not args.no_profile):
        run_playwright_with_cookies(
            args.max_articles,
            out_path,
            args.headless,
            args.debug,
            start_date=args.start_date,
            end_date=args.end_date,
            delay=args.delay,
            max_scrolls=args.scrolls,
        )
        return

    if args.cookies:
        run_cookies(args.max_articles, out_path)
        return

    if args.playwright:
        run_playwright([], args.max_articles, out_path, args.headless)
        return

    # Selenium (Chrome 프로필 - Chrome 종료 필요)
    driver = create_driver(use_profile=not args.no_profile, headless=args.headless)
    try:
        print("목록 페이지에서 기사 URL 수집 중...")
        urls = get_article_urls_from_list(driver, LIST_URL)
        urls = urls[: args.max_articles]
        print(f"수집된 URL: {len(urls)}개")

        results = []
        for i, url in enumerate(urls, 1):
            print(f"[{i}/{len(urls)}] {url}")
            article = extract_article(driver, url)
            results.append(article)
            if article.get("premium_blocked"):
                print("  → 프리미엄 차단됨 (로그인 확인)")
            elif article.get("body"):
                print(f"  → 본문 {len(article['body'])}자 수집")
            time.sleep(1)

        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"\n저장 완료: {out_path}")

    finally:
        driver.quit()


if __name__ == "__main__":
    main()
