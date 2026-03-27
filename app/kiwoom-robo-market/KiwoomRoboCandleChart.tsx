"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  type CandlestickData,
} from "lightweight-charts";
import type { DailyOhlc } from "@/lib/stock-chart-api";
import type { RoboPriceBands } from "@/lib/kiwoom-robo-bands";
import { BandFillGradientPrimitive, BAND_FILL_STYLES } from "./bandGradientFills";

const CHART_HEIGHT = 420;

function toTimeStr(dateStr: string): string {
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

function toCandlestickData(rows: DailyOhlc[]): CandlestickData[] {
  return [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      time: toTimeStr(r.date) as CandlestickData["time"],
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
    }));
}

type Props = {
  ohlc: DailyOhlc[];
  bands: RoboPriceBands;
};

export function KiwoomRoboCandleChart({ ohlc, bands }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || ohlc.length === 0) return;

    const data = toCandlestickData(ohlc);
    const p = bands;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: CHART_HEIGHT,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#64748b",
        fontFamily: "system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#f1f5f9" },
        horzLines: { color: "#f1f5f9" },
      },
      rightPriceScale: {
        borderColor: "#e2e8f0",
        scaleMargins: { top: 0.06, bottom: 0.06 },
      },
      timeScale: {
        borderColor: "#e2e8f0",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { labelVisible: true },
        horzLine: { labelVisible: true },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#0d9488",
      downColor: "#be123c",
      borderUpColor: "#0d9488",
      borderDownColor: "#be123c",
      wickUpColor: "#0d9488",
      wickDownColor: "#be123c",
    });
    series.setData(data);

    const bandDefs = [
      { high: p.buyHigh, low: p.buyLow, key: "buy" as const },
      { high: p.tp1High, low: p.tp1Low, key: "tp1" as const },
      { high: p.tp2High, low: p.tp2Low, key: "tp2" as const },
    ];
    for (const { high, low, key } of bandDefs) {
      const st = BAND_FILL_STYLES[key];
      series.attachPrimitive(
        new BandFillGradientPrimitive(series, high, low, st.fillStrong, st.fillFade)
      );
    }

    const lineDefs = [
      { price: p.buyLow, band: "buy" as const },
      { price: p.buyHigh, band: "buy" as const },
      { price: p.tp1Low, band: "tp1" as const },
      { price: p.tp1High, band: "tp1" as const },
      { price: p.tp2Low, band: "tp2" as const },
      { price: p.tp2High, band: "tp2" as const },
    ];
    for (const { price, band } of lineDefs) {
      const st = BAND_FILL_STYLES[band];
      series.createPriceLine({
        price,
        color: st.axis,
        lineWidth: 1,
        lineVisible: false,
        axisLabelVisible: true,
        title: "",
      });
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [bands, ohlc]);

  if (ohlc.length === 0) return null;

  return <div ref={containerRef} style={{ width: "100%", minHeight: CHART_HEIGHT }} />;
}
