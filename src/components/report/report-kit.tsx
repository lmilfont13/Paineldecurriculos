// Peças compartilhadas pelos relatórios em PDF (vaga e geral): cores, estilos, página e gráficos básicos.
import { G, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

import type { CriterionSummary } from "@/server/models/report.model";

export const C = {
  ink: "#1c1917",
  text: "#44403c",
  muted: "#a8a29e",
  rule: "#e7e5e4",
  tint: "#faf8f6",
  good: "#1f7a4d",
  warn: "#b07818",
  bad: "#b91c1c",
};

export const num = (n: number, digits = 1) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
export const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export const STAGE_LABEL: Record<string, string> = {
  PENDING: "Em triagem",
  SHORTLISTED: "Passou da triagem",
  INTERVIEW: "Entrevista",
  APPROVED: "Aprovados",
  REJECTED: "Reprovados",
};

export const s = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 64, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 9.5, color: C.text },
  eyebrow: { fontSize: 7.5, letterSpacing: 1.6, textTransform: "uppercase", color: C.muted, fontFamily: "Helvetica-Bold" },
  h1: { fontFamily: "Times-Bold", fontSize: 24, color: C.ink, marginTop: 6, lineHeight: 1.15 },
  h2: { fontFamily: "Times-Bold", fontSize: 14, color: C.ink, marginBottom: 6 },
  lead: { fontSize: 10.5, lineHeight: 1.55, color: C.text },
  small: { fontSize: 8, color: C.muted, lineHeight: 1.5 },
  rule: { height: 1, backgroundColor: C.rule, marginVertical: 14 },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted, borderTopWidth: 0.75, borderTopColor: C.rule, paddingTop: 8 },
  kpiRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  kpi: { flex: 1, borderWidth: 0.75, borderColor: C.rule, borderRadius: 6, padding: 12, backgroundColor: C.tint },
  kpiValue: { fontFamily: "Times-Bold", fontSize: 24, color: C.ink },
  kpiLabel: { fontSize: 8.5, color: C.text, marginTop: 2, fontFamily: "Helvetica-Bold" },
  kpiNote: { fontSize: 7.5, color: C.muted, marginTop: 2 },
  th: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.muted, textTransform: "uppercase", letterSpacing: 0.8 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: C.rule },
});

export function PageFrame({ footer, children }: { footer: string; children: React.ReactNode }) {
  return (
    <Page size="A4" style={s.page}>
      {children}
      <View style={s.footer} fixed>
        <Text>{footer}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}

export function SectionTitle({ eyebrow, title, brand }: { eyebrow: string; title: string; brand: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[s.eyebrow, { color: brand }]}>{eyebrow}</Text>
      <Text style={s.h1}>{title}</Text>
    </View>
  );
}

/* ─── gráficos ─────────────────────────────────────────── */

/**
 * Texto dentro de <Svg>. A biblioteca aceita tamanho e alinhamento aqui, mas a
 * tipagem dela não declara essas propriedades; este tipo as descreve.
 */
export const SvgText = Text as unknown as React.ComponentType<{
  x: number;
  y: number;
  fontSize?: number;
  fill?: string;
  textAnchor?: "start" | "middle" | "end";
  children?: React.ReactNode;
}>;


function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arcPath(cx: number, cy: number, r: number, ir: number, a0: number, a1: number): string {
  const end = Math.min(a1, a0 + Math.PI * 2 - 0.0001);
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, end);
  const [x2, y2] = polar(cx, cy, ir, end);
  const [x3, y3] = polar(cx, cy, ir, a0);
  const large = end - a0 > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${ir} ${ir} 0 ${large} 0 ${x3} ${y3} Z`;
}

export function Donut({ data, size = 130 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const cx = size / 2;
  const r = size / 2 - 2;
  let angle = -Math.PI / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {total === 0 ? (
        <Path d={arcPath(cx, cx, r, r * 0.62, 0, Math.PI * 2)} fill={C.rule} />
      ) : (
        data
          .filter((d) => d.value > 0)
          .map((d) => {
            const a1 = angle + (d.value / total) * Math.PI * 2;
            const path = arcPath(cx, cx, r, r * 0.62, angle, a1);
            angle = a1;
            return <Path key={d.label} d={path} fill={d.color} />;
          })
      )}
      <SvgText x={cx} y={cx + 2} textAnchor="middle" fontSize={22} fill={C.ink}>
        {String(total)}
      </SvgText>
      <SvgText x={cx} y={cx + 15} textAnchor="middle" fontSize={7} fill={C.muted}>
        candidatos
      </SvgText>
    </Svg>
  );
}

/** Quantos candidatos atendem cada critério da vaga (verde = atende, âmbar = em parte, rosa = não). */
export function CriteriaBars({ rows }: { rows: CriterionSummary[] }) {
  const W = 499;
  const labelW = 180;
  const rightW = 112;
  const barW = W - labelW - rightW;
  const rowH = 24;
  const H = rows.length * rowH + 4;
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {rows.map((r, i) => {
        const y = 2 + i * rowH;
        const seg = (n: number) => (r.total ? (n / r.total) * barW : 0);
        const wSim = seg(r.sim);
        const wPar = seg(r.parcial);
        const wNao = seg(r.nao);
        return (
          <G key={r.criterion}>
            <SvgText x={0} y={y + 13} fontSize={8.5} fill={C.ink}>
              {cut(r.criterion, 38)}
            </SvgText>
            <Rect x={labelW} y={y + 3} width={Math.max(wSim, 0.01)} height={12} fill={C.good} />
            <Rect x={labelW + wSim} y={y + 3} width={Math.max(wPar, 0.01)} height={12} fill="#e0a526" />
            <Rect x={labelW + wSim + wPar} y={y + 3} width={Math.max(wNao, 0.01)} height={12} fill="#e7c7c7" />
            <SvgText x={labelW + barW + 8} y={y + 13} fontSize={8.5} fill={r.scarce ? C.bad : C.ink}>
              {r.total ? `${num(r.pctSim, 0)}%${r.scarce ? " · escasso" : ""}` : "sem dados"}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
