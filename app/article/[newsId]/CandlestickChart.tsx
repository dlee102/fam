"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type ISeriesPrimitive,
  type IPrimitivePaneRenderer,
  type IPrimitivePaneView,
  type Time,
} from "lightweight-charts";

interface DailyOhlc {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlestickChartProps {
  data: DailyOhlc[];
  refDate?: string;
  height?: number;
}

/** 발행일 세로선 프리미티브 */
class VertLinePaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private x: number | null,
    private color: string,
    private width: number
  ) {}
  draw(target: import("fancy-canvas").CanvasRenderingTarget2D) {
    if (this.x === null) return;
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const px = Math.round(scope.horizontalPixelRatio * this.x!);
      const lineW = Math.max(1, Math.round(this.width * scope.horizontalPixelRatio));
      const start = Math.floor(px - lineW / 2);
      ctx.fillStyle = this.color;
      ctx.fillRect(start, 0, lineW, scope.bitmapSize.height);
    });
  }
}

class VertLinePaneView implements IPrimitivePaneView {
  x: number | null = null;
  constructor(
    private chart: IChartApi,
    private time: Time,
    private color: string,
    private width: number
  ) {}
  update() {
    this.x = this.chart.timeScale().timeToCoordinate(this.time);
  }
  renderer() {
    return new VertLinePaneRenderer(this.x, this.color, this.width);
  }
}

class VertLinePrimitive implements ISeriesPrimitive<Time> {
  private _paneViews: VertLinePaneView[];
  constructor(
    chart: IChartApi,
    time: Time,
    color = "#dc2626",
    width = 2
  ) {
    this._paneViews = [new VertLinePaneView(chart, time, color, width)];
  }
  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }
  paneViews() {
    return this._paneViews;
  }
}

function toTimeStr(dateStr: string): string {
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

export function CandlestickChart({ data, refDate, height = 280 }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const candlestickData: CandlestickData[] = data
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        time: toTimeStr(r.date) as CandlestickData["time"],
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
      }));

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#6b7280",
        fontFamily: "system-ui, sans-serif",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "#f3f4f6" },
        horzLines: { color: "#f3f4f6" },
      },
      rightPriceScale: {
        borderColor: "#e5e7eb",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "#e5e7eb",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { labelVisible: true },
        horzLine: { labelVisible: true },
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#059669",
      downColor: "#dc2626",
      borderUpColor: "#059669",
      borderDownColor: "#dc2626",
    });

    candlestickSeries.setData(candlestickData);

    if (refDate) {
      const refTime = toTimeStr(refDate);
      const exact = candlestickData.find((d) => (d.time as string) === refTime);
      const nearest =
        exact ??
        candlestickData.find((d) => (d.time as string) >= refTime) ??
        candlestickData[candlestickData.length - 1];
      if (nearest) {
        candlestickSeries.attachPrimitive(
          new VertLinePrimitive(chart, nearest.time as Time, "#dc2626", 2)
        );
      }
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
    };
  }, [data, refDate]);

  return <div ref={chartContainerRef} style={{ width: "100%", height }} />;
}
