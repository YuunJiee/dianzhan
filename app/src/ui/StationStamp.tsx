// 車站紀念章：朱紅雙圈、中間站名、下方民國日期，像在車站蓋的章

import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";

import { colors, fonts } from "./theme.ts";

type Props = {
  name: string;
  date?: string; // 例如 "115.10.27"；省略時只有站名
  size?: number;
};

export function StationStamp({ name, date, size = 120 }: Props) {
  // 站名字數不同，字級跟著縮放，讓 2～4 個字都塞得進內圈
  const nameSize = name.length <= 2 ? 34 : name.length === 3 ? 27 : 18;
  const ink = colors.stamp;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx={60} cy={60} r={55} stroke={ink} strokeWidth={5} fill="none" />
      <Circle cx={60} cy={60} r={47} stroke={ink} strokeWidth={1.5} fill="none" />
      <SvgText x={60} y={33} fill={ink} fontFamily={fonts.ticket} fontSize={11} textAnchor="middle" letterSpacing={2}>
        臺灣鐵路
      </SvgText>
      <SvgText
        x={60}
        y={date ? 70 : 72}
        fill={ink}
        fontFamily={fonts.ticket}
        fontSize={nameSize}
        textAnchor="middle"
        letterSpacing={name.length <= 2 ? 4 : name.length === 3 ? 1 : 0}
      >
        {name}
      </SvgText>
      {date && (
        <>
          <Line x1={30} y1={80} x2={90} y2={80} stroke={ink} strokeWidth={1.5} />
          <SvgText x={60} y={95} fill={ink} fontFamily={fonts.ticket} fontSize={12} textAnchor="middle">
            {date}
          </SvgText>
        </>
      )}
    </Svg>
  );
}
