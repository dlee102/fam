import json
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from tqdm import tqdm
import os

def analyze_sentiment():
    input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_classified.json'
    output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_sentiment.json'
    
    print("Loading AI Model (KR-FinBert) direct to your CPU/GPU...")
    model_name = "snunlp/KR-FinBert-SC"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name)
    model.eval()
    
    with open(input_file, 'r', encoding='utf-8') as f:
        articles = json.load(f)
        
    print(f"Total articles to read: {len(articles)}")
    
    # Label mapping in KR-FinBert is usually: 0: negative, 1: neutral, 2: positive (varies, check output)
    # The actual order for snunlp/KR-FinBert-SC:
    # 0: negative, 1: neutral, 2: positive
    
    for idx, article in enumerate(tqdm(articles, desc="AI Reading Articles")):
        # Read the title and the first part of the body
        title = article.get('title', '')
        body = article.get('body', '')
        if not body:
            article['sentiment_score'] = 50 # Neutral if no body
            article['sentiment_label'] = 'neutral'
            continue
            
        # Combine title and body, truncated to fit max length
        text = title + " " + body[:1000] # Use first 1000 characters to be safe for 512 tokens
        
        inputs = tokenizer(text, return_tensors='pt', truncation=True, max_length=512)
        
        with torch.no_grad():
            outputs = model(**inputs)
            probs = torch.nn.functional.softmax(outputs.logits, dim=-1)[0]
            
        # KR-FinBert-SC: 0: negative, 1: neutral, 2: positive
        neg_prob = probs[0].item()
        neu_prob = probs[1].item()
        pos_prob = probs[2].item()
        
        # Calculate 0-100 score: 50 is neutral, 100 is strong positive, 0 is strong negative
        score = (pos_prob - neg_prob + 1) * 50
        
        article['sentiment_score'] = round(score, 2)
        
        # Assign label based on max prob
        if pos_prob > max(neg_prob, neu_prob):
            article['sentiment_label'] = 'positive'
        elif neg_prob > max(pos_prob, neu_prob):
            article['sentiment_label'] = 'negative'
        else:
            article['sentiment_label'] = 'neutral'
            
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=4)
        
    print("\n✅ AI Sentiment Analysis Complete!")
    print(f"Saved results with sentiment scores (0~100) to: {output_file}")
    
if __name__ == '__main__':
    analyze_sentiment()
