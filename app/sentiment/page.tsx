import fs from 'fs';
import path from 'path';
import { getTickerNamesMap } from '@/lib/ticker-names';
import { SentimentTable } from './SentimentTable';

export default async function SentimentPage() {
    const filePath = path.join(process.cwd(), 'pharm_crawler', 'pharm_articles_manual_sentiment.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const articles = JSON.parse(fileContents);

    const sortedArticles = articles
        .filter((a: any) => a.sentiment_score !== undefined && a.title)
        .sort((a: any, b: any) => {
            const dateA = a.published_date ? new Date(a.published_date).getTime() : 0;
            const dateB = b.published_date ? new Date(b.published_date).getTime() : 0;
            return dateA - dateB; // 과거순
        });

    const tickerNames = getTickerNamesMap();

    return (
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 24px', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <header style={{ marginBottom: '24px', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)', letterSpacing: '-0.02em' }}>뉴스+티커</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>{sortedArticles.length}건 기사</p>
            </header>

            <SentimentTable articles={sortedArticles} tickerNames={tickerNames} />
        </div>
    );
}
