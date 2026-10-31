// Gráficos do relatório geral de recrutamento (barras, colunas, empilhadas e mini-histograma).
import { G, Line, Rect, Svg } from "@react-pdf/renderer";

import { C, SvgText, cut, num } from "@/components/report/report-kit";

/** Barras horizontais com o valor (e a parte do total) à direita. */
export function HBars({
  rows,
  total,
  color,
  width = 499,
  labelW = 150,
  rowH = 22,
}: {
  rows: { label: string; value: number }[];
  /** Com total, mostra também a porcentagem de cada linha. */
  total?: number;
  color: string;
  width?: number;
  labelW?: number;
  rowH?: number;
}) {
  const valueW = total ? 70 : 40;
  const plotW = width - labelW - valueW;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const H = rows.length * rowH + 4;
  return (
    <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
      {rows.map((r, i) => {
        const y = 2 + i * rowH;
        const w = (r.value / max) * plotW;
        return (
          <G key={r.label}>
            <SvgText x={0} y={y + 14} fontSize={8.5} fill={C.ink}>
              {cut(r.label, Math.floor(labelW / 4.6))}
            </SvgText>
            <Rect x={labelW} y={y + 4} width={r.value > 0 ? Math.max(w, 1) : 0} height={11} rx={1.5} fill={r.label === "Outros" ? "#d6d3d1" : color} />
            <SvgText x={labelW + w + 6} y={y + 13} fontSize={8.5} fill={C.ink}>
              {total ? `${r.value} · ${num((r.value / total) * 100, 0)}%` : String(r.value)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/** Colunas verticais (evolução no tempo). */
export function Columns({
  data,
  color,
  width = 499,
  height = 130,
  labelEvery = 5,
}: {
  data: { label: string; value: number }[];
  color: string;
  width?: number;
  height?: number;
  labelEvery?: number;
}) {
  const padL = 24;
  const padB = 22;
  const padT = 14;
  const plotW = width - padL - 4;
  const plotH = height - padB - padT;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = plotW / data.length;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line x1={padL} y1={padT + plotH} x2={width - 4} y2={padT + plotH} stroke={C.rule} strokeWidth={1} />
      <Line x1={padL} y1={padT} x2={width - 4} y2={padT} stroke={C.rule} strokeWidth={0.5} strokeDasharray="2 3" />
      <SvgText x={padL - 4} y={padT + 3} fontSize={7} fill={C.muted} textAnchor="end">
        {String(max)}
      </SvgText>
      <SvgText x={padL - 4} y={padT + plotH + 2} fontSize={7} fill={C.muted} textAnchor="end">
        0
      </SvgText>
      {data.map((d, i) => {
        const h = (d.value / max) * plotH;
        const x = padL + i * bw;
        return (
          <G key={d.label}>
            <Rect x={x + bw * 0.15} y={padT + plotH - h} width={bw * 0.7} height={Math.max(h, d.value > 0 ? 1 : 0)} fill={color} rx={1} />
            {i % labelEvery === 0 || i === data.length - 1 ? (
              <SvgText x={x + bw / 2} y={height - 8} fontSize={7} fill={C.muted} textAnchor="middle">
                {d.label}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

/** Uma barra por linha, dividida em partes coloridas (ex.: etapas do funil de cada vaga). */
export function StackedBars({
  rows,
  width = 499,
  labelW = 160,
  rowH = 24,
}: {
  rows: { label: string; parts: { value: number; color: string }[] }[];
  width?: number;
  labelW?: number;
  rowH?: number;
}) {
  const valueW = 34;
  const plotW = width - labelW - valueW;
  const max = Math.max(1, ...rows.map((r) => r.parts.reduce((a, p) => a + p.value, 0)));
  const H = rows.length * rowH + 4;
  return (
    <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
      {rows.map((r, i) => {
        const y = 2 + i * rowH;
        const total = r.parts.reduce((a, p) => a + p.value, 0);
        let x = labelW;
        return (
          <G key={r.label}>
            <SvgText x={0} y={y + 14} fontSize={8.5} fill={C.ink}>
              {cut(r.label, Math.floor(labelW / 4.6))}
            </SvgText>
            {r.parts.map((p, pi) => {
              const w = (p.value / max) * plotW;
              const rect = <Rect key={pi} x={x} y={y + 4} width={Math.max(w, 0)} height={12} fill={p.color} />;
              x += w;
              return rect;
            })}
            <SvgText x={x + 6} y={y + 14} fontSize={8.5} fill={C.ink}>
              {String(total)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/** Histograma pequeno das notas de uma vaga, com a linha do corte. */
export function MiniHistogram({
  bands,
  cutoff,
  color,
  width = 230,
  height = 108,
}: {
  bands: { label: string; count: number }[];
  cutoff: number;
  color: string;
  width?: number;
  height?: number;
}) {
  const padB = 18;
  const padT = 26;
  const plotH = height - padB - padT;
  const max = Math.max(1, ...bands.map((b) => b.count));
  const bw = width / bands.length;
  const cutX = (cutoff / 100) * width;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line x1={0} y1={padT + plotH} x2={width} y2={padT + plotH} stroke={C.rule} strokeWidth={1} />
      {bands.map((b, i) => {
        const h = (b.count / max) * plotH;
        const x = i * bw + bw * 0.2;
        return (
          <G key={b.label}>
            <Rect x={x} y={padT + plotH - h} width={bw * 0.6} height={Math.max(h, 0)} fill={color} rx={1} />
            <SvgText x={x + bw * 0.3} y={padT + plotH - h - 3} fontSize={7.5} fill={C.ink} textAnchor="middle">
              {String(b.count)}
            </SvgText>
            <SvgText x={x + bw * 0.3} y={height - 6} fontSize={6.5} fill={C.muted} textAnchor="middle">
              {b.label}
            </SvgText>
          </G>
        );
      })}
      <Line x1={cutX} y1={8} x2={cutX} y2={padT + plotH} stroke={C.ink} strokeWidth={1} strokeDasharray="3 3" />
      <SvgText x={cutX + 3} y={14} fontSize={6.5} fill={C.ink}>
        {`corte ${cutoff}`}
      </SvgText>
    </Svg>
  );
}
