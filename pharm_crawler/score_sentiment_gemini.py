import json
import os
import time
import google.generativeai as genai
from tqdm import tqdm

def analyze_with_gemini():
    # Attempt to load the API key
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("\n❌ [ERROR] GEMINI_API_KEY is not set in your environment variables.")
        print("To run this, you must have an API key from Google AI Studio (aistudio.google.com).")
        print("Run matching: export GEMINI_API_KEY='your_api_key_here' in your terminal.")
        return

    genai.configure(api_key=api_key)
    # Using Gemini 1.5 Pro (which is the model tier often associated with Gemini Advanced/Ultra capabilities)
    model = genai.GenerativeModel('gemini-1.5-pro')
    
    input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_classified.json'
    output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_sentiment_gemini.json'
    
    with open(input_file, 'r', encoding='utf-8') as f:
        articles = json.load(f)
        
    print(f"Total articles for Gemini to read: {len(articles)}")
    
    success_count = 0
    
    for idx, article in enumerate(tqdm(articles, desc="Gemini Reading Articles")):
        title = article.get('title', '')
        body = article.get('body', '')
        
        if not body:
            article['sentiment_score'] = 50
            article['sentiment_label'] = 'neutral'
            article['gemini_reasoning'] = '본문 내용이 없어 분석 불가'
            continue
            
        prompt = f"""
다음은 제약/바이오/의료 관련 뉴스 기사입니다. 기사 내용을 바탕으로 해당 기업(들)의 주가 모멘텀에 미칠 **종합적인 감성 점수(0~100점)**와 **한 줄 이유**를 분석해주세요.

- 100점: 초강력 호재 (예: FDA 신약 승인, 조 단위 기술 수출, 대규모 흑자 전환 등)
- 75점: 긍정적 호재 (예: 임상 성공, 유의미한 파트너십, 실적 호조 등)
- 50점: 중립 (예: 단순 정보 전달, 박람회 참석, 명확한 호재/악재 없음)
- 25점: 부정적 악재 (예: 단기 실적 부진, 임상 지연, 유증 등)
- 0점: 초강력 악재 (예: 상장폐지 징후, 임상 완전 실패, 임원 배임/횡령, 거래정지 등)

반드시 아래와 같은 순수 JSON 형식으로만 응답해주세요. 마크다운(```json)이나 다른 설명 없이 JSON만 반환해야 합니다.
{{
  "score": (0~100 사이의 정수),
  "reasoning": (기반이 된 한 줄 요약 및 이유를 한국어로 작성)
}}

기사 제목: {title}
기사 본문 (요약): {body[:800]}
"""
        
        try:
            # We add a slight delay to respect rate limits
            time.sleep(2)
            response = model.generate_content(prompt)
            
            # Clean up potential markdown formatting from the response
            text = response.text.replace("```json", "").replace("```", "").strip()
            
            result = json.loads(text)
            score = int(result.get('score', 50))
            
            article['sentiment_score'] = score
            article['gemini_reasoning'] = result.get('reasoning', '')
            
            if score > 60:
                article['sentiment_label'] = 'positive'
            elif score < 40:
                article['sentiment_label'] = 'negative'
            else:
                article['sentiment_label'] = 'neutral'
                
            success_count += 1
                
        except Exception as e:
            # In case of quota errors or parse errors
            print(f"\nError at index {idx} ({title}): {str(e)}")
            article['sentiment_score'] = 50
            article['sentiment_label'] = 'neutral'
            article['gemini_reasoning'] = f"API 오류 발생: {str(e)}"
            
            # If we hit quota limits, pause longer
            if "429" in str(e) or "quota" in str(e).lower():
                print("Rate limit reached. Pausing for 10 seconds...")
                time.sleep(10)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=4)
        
    print(f"\n✅ Gemini (Ultra Level) Sentiment Analysis Complete: {success_count}/{len(articles)} 성공")
    print(f"Saved results to: {output_file}")

if __name__ == '__main__':
    analyze_with_gemini()
