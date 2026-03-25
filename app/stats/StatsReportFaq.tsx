"use client";

import { useCallback, useId, useState } from "react";

type FaqItem = { q: string; a: string };

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "기사 293건인데 ‘분석 쌍’이 1038이 나온 이유는 무엇인가요?",
    a: "상단 파이프라인 수치는 `post_publish_positive_clustering` 집계 기준으로, (기사×종목)마다 T+1·T+3·T+5일 수익을 각각 한 번씩 세기 때문에 **한 쌍이 최대 3번** 잡힐 수 있습니다. 즉 ‘기사–종목 쌍의 개수’와 동일한 숫자가 아니라, **기간별로 계산에 성공한 관측치 수의 합**에 가깝습니다.",
  },
  {
    q: "‘시세 부족으로 제외’ 52건은 구체적으로 무엇인가요?",
    a: "클러스터링 스크립트 기준으로는 (1) 일봉 파일이 없거나 퍼블 일 이후 첫 종가를 못 찾은 경우, (2) 해당 기간(T+1/3/5)만큼 **미래 거래일 종가가 부족**한 경우가 제외에 포함됩니다. 제외 티커 목록(`excluded_tickers`)에 있는 종목은 애초에 분석에서 빠집니다.",
  },
  {
    q: "Baseline의 n=637과 상단 1038, 입장·보유 표의 n=253이 왜 모두 다른가요?",
    a: "**서로 다른 JSON·스크립트**에서 나온 값입니다. Baseline(`advanced_stats.json`)은 `pharm_articles_manual_sentiment.json`과 장 마감 전후에 따른 T0 조정, T0 종가→T+N 종가 수익으로 집계된 **637건**입니다. 상단 1038은 `news_tickers.json` 기반 클러스터링의 (기사×종목×기간) 관측 합입니다. 입장·보유 표(`entry_hold_stats.json`)는 같은 `news_tickers.json`이라도 **T+1 시가 진입·최대 10거래일 보유** 등 더 빡센 가정과 `idx+10` 이상 미래 데이터 조건으로 **약 253건**(보유 10일·B입장은 일부 케이스가 더 짧아 **244건** 등)으로 줄어듭니다. 그래서 **한 줄 표로 나란히 ‘동일 유니버스’라고 보시면 안 됩니다.**",
  },
  {
    q: "당일 종가·익일 시가·익일 종가 매수는 실제로 체결 가능한가요?",
    a: "백테스트는 **가격이 그 가격에 체결된다고 가정**한 이론값입니다. 장중 갭, 호가 스프레드, 유동성, 상한가 등은 반영하지 않았습니다. 특히 뉴스 직후 급변동 구간에서는 실제 체결가가 가정과 크게 다를 수 있습니다.",
  },
  {
    q: "수수료·세금·슬리피지를 넣으면 결론이 바뀌나요?",
    a: "거래 비용과 슬리피지를 빼면 **체감 수익률은 전 구간에서 내려갑니다.** 짧은 보유·높은 회전일수록 영향이 큽니다. 본 보고서 수치는 **총비용 전·단순 가격 수익률**이므로, 내부에서 사용할 때는 예상 비용을 빼서 재해석하는 것이 안전합니다.",
  },
  {
    q: "손절·분할매수·공매도는 없는 건가요?",
    a: "네. **한 번에 매수 후 지정 거래일 종가에 전량 매도**하는 단순 규칙만 있습니다. 실제 운용 규칙과 1:1로 대응한다고 보시면 안 됩니다.",
  },
  {
    q: "‘퀀트 긍정 신호’만 골라서 최적 입장·보유를 본 건가요?",
    a: "`entry_hold_stats.json`은 `scripts/entry_hold_analysis.py`가 **긍정 신호로 먼저 필터링하지 않고**, 시세·제외 티커·미래 데이터 조건을 통과한 쌍에 대해 입장(A/B/C)×보유일 그리드 전체를 계산한 뒤, 그중 **승률 최대 칸·평균 수익 최대 칸**을 고른 결과입니다. 화면의 ‘퀀트 긍정 신호’ 문구는 **서비스 관점에서 시그널과 함께 읽히도록 한 표현**이며, 통계 파일만 놓고 보면 ‘긍정 필터 적용 후 최적화’와는 다릅니다. 긍정 조건을 걸어 재집계하려면 스크립트에 필터를 추가해 파이프라인을 맞추는 편이 좋습니다.",
  },
  {
    q: "종합 리포트의 기술적 퀀트 점수(모멘텀·추세·유동성·거래량)는 어떻게 산출되나요?",
    a: "`/api/quant/scores` → `quant.run`이 parquet(체결·호가·외국인 흐름)을 읽어 **해당 영업일(D) 전 유니버스 횡단면**에서 스코어를 만듭니다. **모멘텀**: 일중 `(종가에 가까운 체결 − 시가)/시가`의 **퍼센타일 랭크**. **추세**: 일중 고가·저가 폭 대비 종가 위치로 −1~1 → 0~100. **유동성(스프레드)**: 1호가 스프레드를 **낮을수록** 좋게 보고 역퍼센타일. **거래량**: 당일 누적거래량의 퍼센타일. 리포트 UI는 이 네 값을 **30%·30%·20%·20%** 로 가중해 종합 점수를 씁니다. (호가 불균형·외국인 순매수 점수는 모듈에 있으나 현재 레이더 4축에는 미포함.) 자세한 정의는 `quant/README.md`·`quant/scores/*.py`를 기준으로 하면 됩니다.",
  },
  {
    q: "리포트의 ‘퀀트 인텔리전스 지표’ 단기·중기·장기와 이 /stats 페이지는 같은 건가요?",
    a: "**데이터 소스와 목적이 다릅니다.** `/stats`는 뉴스–종목 쌍에 대한 **이벤트 스터디·백테스트 집계**(T+N 수익, 입장×보유 그리드 등)이고, 리포트의 일중 스코어는 **특정 일자 시장 스냅샷**에서 나온 횡단면 팩터입니다. 또한 리포트의 단기·중기·장기 **매수/보유 라벨**은 구현에 따라 **데모용 상수**로 둘 수 있으니, 대외·내부 설명 시에는 실제로 쓰는 **연속 점수→이산 시그널 매핑(임계치·리밸런싱 주기)** 을 문서·코드와 일치시키는 것이 안전합니다.",
  },
  {
    q: "미래 정보 누수(look-ahead)는 없나요?",
    a: "각 스크립트는 퍼블리시 일자·당시 일봉만 사용해 T0(또는 그 다음 거래일)를 잡고, **그 시점 이후 종가·시가**로 수익을 냅니다. 다만 **뉴스 본문 NLP나 사후에 정의된 라벨**을 같은 시점에 쓸 수 있었는지는 데이터 소스별로 따로 점검이 필요합니다.",
  },
  {
    q: "여러 입장×보유 조합 중 ‘최고’만 골랐는데 과대평가 아닌가요?",
    a: "**맞습니다.** 그리드 전체를 탐색한 뒤 극값만 제시하면 **다중 비교로 우연히 좋아 보일 여지**가 있습니다. 엄밀한 해석을 위해서는 (1) 사전에 고정한 규칙만 보고, (2) 신뢰구간·부트스트랩, (3) 기간·표본을 나눈 검증을 권장합니다.",
  },
  {
    q: "승률·평균 수익에 신뢰구간은 없나요?",
    a: "현재 보고서에는 **점 추정치**만 있습니다. 고객사 공유용으로는 표본 크기(n)와 함께 구간 추정을 붙이는 것이 설득력과 투명성 측면에서 유리합니다.",
  },
  {
    q: "특정 시장 국면(상승장)에 치우친 결과 아닌가요?",
    a: "바이오/제약 뉴스와 유니버스가 **한 시장·한 기간**에 묶여 있으면 전체 시장 베타의 영향을 받습니다. 섹터·시장 지수 대비 초과수익을 보고 싶다면 벤치마크 조정이 별도로 필요합니다.",
  },
  {
    q: "이 수치를 대외적으로 ‘기대 수익’처럼 써도 되나요?",
    a: "**아니요.** 과거 백테스트이며 미래를 보장하지 않습니다. 투자 권유·성과 표시는 관할 규정·내부 컴플라이언스에 맞게 문구와 면책을 정해야 합니다. 본 페이지 하단에도 그 취지를 적어 두었습니다.",
  },
];

export function StatsReportFaq() {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = useCallback((i: number) => {
    setOpenIndex((prev) => (prev === i ? null : i));
  }, []);

  return (
    <section style={{ marginTop: "40px", marginBottom: "56px" }}>
      <h2 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "8px" }}>
        자주 묻는 질문 (고객사 검토용)
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: "14px", lineHeight: 1.65, color: "#525252" }}>
        바로 위 요약 수치와 이후 표·그래프를 검토할 때 나올 수 있는 질문과, 코드·데이터 파이프라인 기준 답변입니다.
      </p>
      <div style={{ borderTop: "1px solid #e5e5e5" }}>
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = openIndex === i;
          const panelId = `${baseId}-panel-${i}`;
          const btnId = `${baseId}-btn-${i}`;
          return (
            <div key={i} style={{ borderBottom: "1px solid #e5e5e5" }}>
              <button
                type="button"
                id={btnId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(i)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "16px 4px",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  font: "inherit",
                  color: "#171717",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    marginTop: "2px",
                    fontSize: "12px",
                    color: "#737373",
                    width: "1.25rem",
                    display: "inline-block",
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  ▶
                </span>
                <span style={{ fontSize: "15px", fontWeight: 600, lineHeight: 1.5 }}>
                  Q. {item.q}
                </span>
              </button>
              <div
                id={panelId}
                role="region"
                aria-labelledby={btnId}
                style={{
                  display: isOpen ? "block" : "none",
                  padding: isOpen ? "0 4px 18px calc(1.25rem + 12px + 4px)" : 0,
                  fontSize: "14px",
                  lineHeight: 1.75,
                  color: "#404040",
                }}
              >
                <p style={{ margin: 0 }}>A. {item.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
