import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesApi,
  ISeriesPrimitive,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  PrimitivePaneViewZOrder,
  SeriesType,
  Time,
} from "lightweight-charts";

/** 가격 구간 사각형 + 우→좌 연한 투명 그라데이션 (캔들 아래 레이어) */
class BandFillRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly yTop: number | null,
    private readonly yBottom: number | null,
    private readonly colorStrong: string,
    private readonly colorFade: string
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    if (this.yTop === null || this.yBottom === null) return;
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const w = scope.bitmapSize.width;
      const top = Math.round(this.yTop * scope.verticalPixelRatio);
      const bottom = Math.round(this.yBottom * scope.verticalPixelRatio);
      const height = Math.max(1, bottom - top);
      const midY = top + height / 2;

      const grad = ctx.createLinearGradient(0, midY, w, midY);
      grad.addColorStop(0, this.colorFade);
      grad.addColorStop(0.5, this.colorFade);
      grad.addColorStop(1, this.colorStrong);

      ctx.fillStyle = grad;
      ctx.fillRect(0, top, w, height);
    });
  }
}

class BandFillPaneView implements IPrimitivePaneView {
  private yTop: number | null = null;
  private yBottom: number | null = null;

  constructor(
    private readonly series: ISeriesApi<SeriesType, Time>,
    private readonly priceHigh: number,
    private readonly priceLow: number,
    private readonly colorStrong: string,
    private readonly colorFade: string
  ) {}

  zOrder(): PrimitivePaneViewZOrder {
    return "bottom";
  }

  update(): void {
    const a = this.series.priceToCoordinate(this.priceHigh);
    const b = this.series.priceToCoordinate(this.priceLow);
    if (a === null || b === null) {
      this.yTop = null;
      this.yBottom = null;
      return;
    }
    this.yTop = Math.min(a, b);
    this.yBottom = Math.max(a, b);
  }

  renderer(): IPrimitivePaneRenderer | null {
    return new BandFillRenderer(this.yTop, this.yBottom, this.colorStrong, this.colorFade);
  }
}

export class BandFillGradientPrimitive implements ISeriesPrimitive<Time> {
  private readonly _paneViews: BandFillPaneView[];

  constructor(
    series: ISeriesApi<SeriesType, Time>,
    priceHigh: number,
    priceLow: number,
    colorStrong: string,
    colorFade: string
  ) {
    this._paneViews = [new BandFillPaneView(series, priceHigh, priceLow, colorStrong, colorFade)];
  }

  updateAllViews(): void {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this._paneViews;
  }
}

/** 밴별: 축 라벨 색 + 채움(우측 진함 → 좌측 페이드) */
export const BAND_FILL_STYLES: Record<
  "buy" | "tp1" | "tp2",
  { axis: string; fillStrong: string; fillFade: string }
> = {
  buy: {
    axis: "#0d9488",
    fillStrong: "rgba(13, 148, 136, 0.16)",
    fillFade: "rgba(13, 148, 136, 0.02)",
  },
  tp1: {
    axis: "#b45309",
    fillStrong: "rgba(180, 83, 9, 0.14)",
    fillFade: "rgba(202, 138, 4, 0.02)",
  },
  tp2: {
    axis: "#4338ca",
    fillStrong: "rgba(67, 56, 202, 0.13)",
    fillFade: "rgba(99, 102, 241, 0.02)",
  },
};
