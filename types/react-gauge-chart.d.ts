declare module "react-gauge-chart" {
  import { FC } from "react";
  interface GaugeChartProps {
    id: string;
    nrOfLevels?: number;
    percent?: number;
    colors?: string[];
    arcWidth?: number;
    arcPadding?: number;
    cornerRadius?: number;
    needleColor?: string;
    needleBaseColor?: string;
    textColor?: string;
    formatTextValue?: (value: string) => string;
    style?: React.CSSProperties;
    animate?: boolean;
    animDelay?: number;
    animateDuration?: number;
    hideText?: boolean;
  }
  const GaugeChart: FC<GaugeChartProps>;
  export default GaugeChart;
}
