/**
 * 바이오·헬스케어 1차 비즈니스 타입 (종목 단위 분류용).
 */

export const BIO_BUSINESS_TYPES = [
  {
    id: "rd_pipeline",
    label: "신약 R&D (파이프라인 중심)",
  },
  {
    id: "platform_licensing",
    label: "기술이전/라이선스 수익 비중 큰 플랫폼·바이오텍",
  },
  {
    id: "cdmo",
    label: "CMO/CDMO·위탁생산 (제조 인프라)",
  },
  {
    id: "cro",
    label: "CRO·비임상/임상 지원",
  },
  {
    id: "dx_ivd",
    label: "진단·IVD·장비",
  },
  {
    id: "upstream_supply",
    label: "원료/API·배지·시약 등 밸류체인 상류",
  },
] as const;

export type BioBusinessTypeId = (typeof BIO_BUSINESS_TYPES)[number]["id"] | "unknown";

export const BIO_BUSINESS_TYPE_IDS = BIO_BUSINESS_TYPES.map((t) => t.id) as readonly string[];

export function labelForBioBusinessType(id: string): string | undefined {
  return BIO_BUSINESS_TYPES.find((t) => t.id === id)?.label;
}
