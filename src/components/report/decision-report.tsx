import {
  Circle,
  Document,
  G,
  Line,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

import {
  INDEX_WEIGHTS,
  executiveSummary,
  type RankedCandidate,
  type ReportCandidate,
  type ReportData,
} from "@/server/models/report.model";

/** Texto comparativo da IA para um finalista (opcional: o relatório funciona sem ele). */
export type FinalistNote = { reason: string; strengths: string[]; concerns: string[] };

const C = {
  ink: "#1c1917",
  text: "#44403c",
  muted: "#a8a29e",
  rule: "#e7e5e4",
  tint: "#faf8f6",
  good: "#1f7a4d",
  warn: "#b07818",
  bad: "#b91c1c",
};

const num = (n: number, digits = 1) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

const STAGE_LABEL: Record<string, string> = {
  PENDING: "Em triagem",
  INTERVIEW: "Entrevista",
  APPROVED: "Aprovados",
  REJECTED: "Reprovados",
};

const s = StyleSheet.create({
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

function PageFrame({
  data,
  company,
  children,
}: {
  data: ReportData;
  company: string;
  children: React.ReactNode;
}) {
  return (
    <Page size="A4" style={s.page}>
      {children}
      <View style={s.footer} fixed>
        <Text>
          Confidencial · {company} · {cut(data.job.title, 40)}
          {data.job.code ? ` #${data.job.code}` : ""}
        </Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}

function SectionTitle({ eyebrow, title, brand }: { eyebrow: string; title: string; brand: string }) {
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
const SvgText = Text as unknown as React.ComponentType<{
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

function Donut({ data, size = 130 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
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

function Histogram({ data, brand }: { data: ReportData; brand: string }) {
  const W = 499;
  const H = 150;
  const padL = 8;
  const padB = 24;
  const plotW = W - padL * 2;
  const plotH = H - padB - 18;
  const max = Math.max(1, ...data.bands.map((b) => b.count));
  const bw = plotW / data.bands.length;
  const cutX = padL + (data.job.aiMinScore / 100) * plotW;
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Line x1={padL} y1={18 + plotH} x2={W - padL} y2={18 + plotH} stroke={C.rule} strokeWidth={1} />
      {data.bands.map((b, i) => {
        const h = (b.count / max) * plotH;
        const x = padL + i * bw + bw * 0.18;
        return (
          <G key={b.label}>
            <Rect x={x} y={18 + plotH - h} width={bw * 0.64} height={h} fill={b.from >= data.job.aiMinScore ? brand : b.to >= data.job.aiMinScore ? brand : "#d6d3d1"} opacity={b.from >= data.job.aiMinScore ? 1 : b.to >= data.job.aiMinScore ? 0.45 : 1} />
            <SvgText x={x + bw * 0.32} y={18 + plotH - h - 5} textAnchor="middle" fontSize={9} fill={C.ink}>
              {String(b.count)}
            </SvgText>
            <SvgText x={x + bw * 0.32} y={H - 8} textAnchor="middle" fontSize={7.5} fill={C.muted}>
              {b.label}
            </SvgText>
          </G>
        );
      })}
      <Line x1={cutX} y1={10} x2={cutX} y2={18 + plotH} stroke={C.bad} strokeWidth={1} strokeDasharray="3 3" />
      <SvgText x={cutX + 4} y={14} fontSize={7.5} fill={C.bad}>
        {`corte ${data.job.aiMinScore}`}
      </SvgText>
    </Svg>
  );
}

/** Distribuição das notas em um traço: mín–máx, quartis, mediana, média e o corte da vaga. */
function RangeBar({ data, brand }: { data: ReportData; brand: string }) {
  const st = data.stats;
  if (!st) return null;
  const W = 499;
  const padL = 12;
  const plotW = W - padL * 2;
  const x = (v: number) => padL + (v / 100) * plotW;
  return (
    <Svg width={W} height={62} viewBox={`0 0 ${W} 62`}>
      <Line x1={padL} y1={30} x2={W - padL} y2={30} stroke={C.rule} strokeWidth={1} />
      {[0, 25, 50, 75, 100].map((t) => (
        <G key={t}>
          <Line x1={x(t)} y1={30} x2={x(t)} y2={34} stroke={C.muted} strokeWidth={0.75} />
          <SvgText x={x(t)} y={46} textAnchor="middle" fontSize={7} fill={C.muted}>
            {String(t)}
          </SvgText>
        </G>
      ))}
      <Line x1={x(st.min)} y1={22} x2={x(st.max)} y2={22} stroke={C.muted} strokeWidth={1} />
      <Rect x={x(st.q1)} y={14} width={Math.max(1, x(st.q3) - x(st.q1))} height={16} fill={brand} opacity={0.22} stroke={brand} strokeWidth={0.75} />
      <Line x1={x(st.median)} y1={12} x2={x(st.median)} y2={32} stroke={brand} strokeWidth={2} />
      <Circle cx={x(st.mean)} cy={22} r={3} fill={C.ink} />
      <Line x1={x(data.job.aiMinScore)} y1={6} x2={x(data.job.aiMinScore)} y2={36} stroke={C.bad} strokeWidth={1} strokeDasharray="3 3" />
      <SvgText x={x(data.job.aiMinScore) + 3} y={9} fontSize={7} fill={C.bad}>
        corte
      </SvgText>
    </Svg>
  );
}

function ScoreBars({ rows, data, brand }: { rows: RankedCandidate[]; data: ReportData; brand: string }) {
  const W = 499;
  const labelW = 118;
  const valueW = 52;
  const plotW = W - labelW - valueW;
  const rowH = 22;
  const H = rows.length * rowH + 26;
  const x = (v: number) => labelW + (v / 100) * plotW;
  const mean = data.stats?.mean ?? 0;
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {[0, 25, 50, 75, 100].map((t) => (
        <G key={t}>
          <Line x1={x(t)} y1={4} x2={x(t)} y2={rows.length * rowH + 4} stroke={C.rule} strokeWidth={0.5} />
          <SvgText x={x(t)} y={H - 6} textAnchor="middle" fontSize={7} fill={C.muted}>
            {String(t)}
          </SvgText>
        </G>
      ))}
      {rows.map((r, i) => {
        const y = 4 + i * rowH;
        const meets = (r.aiScore ?? 0) >= data.job.aiMinScore;
        return (
          <G key={r.id}>
            <SvgText x={0} y={y + 14} fontSize={8.5} fill={C.ink}>
              {`${r.position}. ${cut(r.name, 22)}`}
            </SvgText>
            <Rect x={labelW} y={y + 4} width={(r.aiScore ?? 0) / 100 * plotW} height={9} fill={meets ? brand : "#d6d3d1"} />
            {/* losango = índice de decisão */}
            <Path
              d={`M ${x(r.index)} ${y + 2} L ${x(r.index) + 5} ${y + 8.5} L ${x(r.index)} ${y + 15} L ${x(r.index) - 5} ${y + 8.5} Z`}
              fill={C.ink}
            />
            <SvgText x={W - valueW + 10} y={y + 13} fontSize={8.5} fill={C.ink}>
              {`${num(r.aiScore ?? 0, 0)} · ${num(r.index)}`}
            </SvgText>
          </G>
        );
      })}
      <Line x1={x(data.job.aiMinScore)} y1={0} x2={x(data.job.aiMinScore)} y2={rows.length * rowH + 4} stroke={C.bad} strokeWidth={1} strokeDasharray="3 3" />
      <Line x1={x(mean)} y1={0} x2={x(mean)} y2={rows.length * rowH + 4} stroke={C.warn} strokeWidth={1} strokeDasharray="1 3" />
    </Svg>
  );
}

const MET_COLOR = { sim: C.good, parcial: "#e0a526", não: "#e7c7c7" } as const;

function Heatmap({ rows, criteria, brand }: { rows: RankedCandidate[]; criteria: string[]; brand: string }) {
  const W = 499;
  const labelW = 120;
  const covW = 56;
  const cellW = Math.min(46, (W - labelW - covW) / Math.max(1, criteria.length));
  const rowH = 24;
  const H = rows.length * rowH + 46;
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {criteria.map((_, ci) => (
        <SvgText key={ci} x={labelW + ci * cellW + cellW / 2} y={12} textAnchor="middle" fontSize={8} fill={C.muted}>
          {`C${ci + 1}`}
        </SvgText>
      ))}
      <SvgText x={labelW + criteria.length * cellW + 10} y={12} fontSize={7.5} fill={C.muted}>
        cobertura
      </SvgText>
      {rows.map((r, ri) => {
        const y = 22 + ri * rowH;
        return (
          <G key={r.id}>
            <SvgText x={0} y={y + 14} fontSize={8.5} fill={C.ink}>
              {`${r.position}. ${cut(r.name, 24)}`}
            </SvgText>
            {criteria.map((crit, ci) => {
              const met = r.criteria.find((k) => k.criterion === crit)?.met;
              return (
                <Rect
                  key={ci}
                  x={labelW + ci * cellW + 2}
                  y={y + 2}
                  width={cellW - 4}
                  height={rowH - 6}
                  rx={2}
                  fill={met ? MET_COLOR[met] : "#f1f0ee"}
                />
              );
            })}
            <SvgText x={labelW + criteria.length * cellW + 10} y={y + 14} fontSize={8.5} fill={C.ink}>
              {r.coverage === null ? "—" : `${num(r.coverage, 0)}%`}
            </SvgText>
          </G>
        );
      })}
      <G>
        <Rect x={0} y={H - 10} width={8} height={8} rx={1} fill={C.good} />
        <SvgText x={12} y={H - 3} fontSize={7.5} fill={C.muted}>atende</SvgText>
        <Rect x={60} y={H - 10} width={8} height={8} rx={1} fill="#e0a526" />
        <SvgText x={72} y={H - 3} fontSize={7.5} fill={C.muted}>em parte</SvgText>
        <Rect x={124} y={H - 10} width={8} height={8} rx={1} fill="#e7c7c7" />
        <SvgText x={136} y={H - 3} fontSize={7.5} fill={C.muted}>não encontrado</SvgText>
        <Rect x={218} y={H - 10} width={8} height={8} rx={1} fill="#f1f0ee" />
        <SvgText x={230} y={H - 3} fontSize={7.5} fill={C.muted}>sem análise</SvgText>
      </G>
    </Svg>
  );
}

const MET_LABEL = { sim: "atende", parcial: "atende em parte", não: "não encontrado" } as const;

function CandidateSheet({
  c,
  brand,
  note,
}: {
  c: ReportCandidate | RankedCandidate;
  brand: string;
  note?: FinalistNote;
}) {
  const ranked = "position" in c;
  const where = [c.neighborhood, c.city].filter(Boolean).join(", ");
  return (
    <View wrap={false} style={{ borderWidth: 0.75, borderColor: C.rule, borderRadius: 6, padding: 13, marginBottom: 11 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ width: 26, fontFamily: "Times-Bold", fontSize: 18, color: ranked ? brand : C.muted }}>
          {ranked ? String((c as RankedCandidate).position) : "—"}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Times-Bold", fontSize: 12.5, color: C.ink }}>{c.name}</Text>
          <Text style={s.small}>
            {[c.aiProfile, c.aiArea, c.aiLevel].filter(Boolean).join(" · ") || "Perfil não identificado"} · {STAGE_LABEL[c.status] ?? c.status}
          </Text>
        </View>
        {ranked ? (
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Times-Bold", fontSize: 17, color: C.ink }}>{num((c as RankedCandidate).index)}</Text>
            <Text style={s.small}>
              nota {num(c.aiScore ?? 0, 0)} · cobertura{" "}
              {(c as RankedCandidate).coverage === null ? "—" : `${num((c as RankedCandidate).coverage as number, 0)}%`}
            </Text>
          </View>
        ) : (
          <Text style={s.small}>sem análise</Text>
        )}
      </View>

      <Text style={[s.th, { marginTop: 9, marginBottom: 3 }]}>Leitura da IA</Text>
      <Text style={{ fontSize: 9, lineHeight: 1.5, color: C.text }}>
        {c.aiReasoning?.trim() || "Ainda não há leitura da IA registrada para este candidato."}
      </Text>

      {note?.reason ? (
        <Text style={{ fontSize: 8.5, lineHeight: 1.5, color: C.muted, marginTop: 5 }}>
          Comparativo entre candidatos: {note.reason}
        </Text>
      ) : null}

      {c.criteria.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={[s.th, { marginBottom: 3 }]}>Critério por critério</Text>
          {c.criteria.map((k) => (
            <View key={k.criterion} style={{ flexDirection: "row", marginBottom: 2.5 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 1.5,
                  marginTop: 3,
                  marginRight: 6,
                  backgroundColor: k.met === "sim" ? C.good : k.met === "parcial" ? "#e0a526" : "#e7c7c7",
                }}
              />
              <Text style={{ flex: 1, fontSize: 8.5, lineHeight: 1.45 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink }}>{k.criterion}</Text>
                <Text style={{ color: C.muted }}> — {MET_LABEL[k.met]}</Text>
                {k.evidence?.trim() ? <Text>. {cut(k.evidence.trim(), 170)}</Text> : null}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ flexDirection: "row", marginTop: 8, borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 7 }}>
        {[
          ["Pretensão", c.salaryExpectation],
          ["Disponibilidade", c.availability],
          ["Localização", where || null],
        ].map(([k, v]) => (
          <View key={k as string} style={{ flex: 1 }}>
            <Text style={s.th}>{k}</Text>
            <Text style={{ marginTop: 2, color: C.ink, fontSize: 8.5 }}>{v ? cut(String(v), 34) : "não informado"}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ─── documento ────────────────────────────────────────── */

export function DecisionReport({
  data,
  company,
  brand = "#7a1f3d",
  notes = null,
}: {
  data: ReportData;
  company: string;
  brand?: string;
  notes?: Record<string, FinalistNote> | null;
}) {
  const summary = executiveSummary(data);
  const finalists = data.ranking.slice(0, 3);
  const compared = data.ranking.slice(0, 12);
  const heat = data.ranking.slice(0, 10);
  const criteria = data.job.criteria.slice(0, 8);
  const date = data.generatedAt.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const jobLabel = `${data.job.title}${data.job.code ? ` #${data.job.code}` : ""}`;
  const st = data.stats;

  const stageColors: Record<string, string> = { PENDING: "#e0a526", INTERVIEW: brand, APPROVED: C.good, REJECTED: "#d6d3d1" };

  return (
    <Document title={`Relatório de decisão — ${jobLabel}`} author={company} subject="Comparativo de candidatos">
      {/* Capa */}
      <Page size="A4" style={{ fontFamily: "Helvetica" }}>
        <View style={{ height: 470, backgroundColor: brand, paddingHorizontal: 56, paddingTop: 64 }}>
          <Svg width={595} height={470} viewBox="0 0 595 470" style={{ position: "absolute", right: 0, top: 0 }}>
            <Circle cx={520} cy={40} r={150} fill="#ffffff" opacity={0.06} />
            <Circle cx={440} cy={150} r={80} fill="#ffffff" opacity={0.05} />
          </Svg>
          <Text style={{ fontSize: 9, letterSpacing: 2.4, color: "#ffffff", opacity: 0.8, textTransform: "uppercase", fontFamily: "Helvetica-Bold" }}>
            {company}
          </Text>
          <Text style={{ fontFamily: "Times-Bold", fontSize: 46, color: "#ffffff", marginTop: 150, lineHeight: 1.05 }}>
            Relatório de{"\n"}decisão
          </Text>
          <Text style={{ fontFamily: "Times-Roman", fontSize: 18, color: "#ffffff", opacity: 0.9, marginTop: 18 }}>
            Comparativo de candidatos
          </Text>
        </View>
        <View style={{ paddingHorizontal: 56, paddingTop: 36 }}>
          <Text style={s.eyebrow}>Vaga</Text>
          <Text style={{ fontFamily: "Times-Bold", fontSize: 24, color: C.ink, marginTop: 6 }}>{jobLabel}</Text>
          <View style={[s.rule, { marginVertical: 22 }]} />
          <View style={{ flexDirection: "row", gap: 40 }}>
            <View>
              <Text style={s.eyebrow}>Emitido em</Text>
              <Text style={{ fontSize: 11, color: C.ink, marginTop: 4 }}>{date}</Text>
            </View>
            <View>
              <Text style={s.eyebrow}>Candidatos</Text>
              <Text style={{ fontSize: 11, color: C.ink, marginTop: 4 }}>{data.totals.total} no processo</Text>
            </View>
            <View>
              <Text style={s.eyebrow}>Destinatário</Text>
              <Text style={{ fontSize: 11, color: C.ink, marginTop: 4 }}>Diretoria</Text>
            </View>
          </View>
          <Text style={[s.small, { marginTop: 56 }]}>
            Documento confidencial. Contém dados pessoais de candidatos, protegidos pela LGPD: use apenas para a decisão
            desta seleção e não encaminhe a terceiros.
          </Text>
        </View>
      </Page>

      {/* Resumo executivo */}
      <PageFrame data={data} company={company}>
        <SectionTitle eyebrow="01 · Resumo executivo" title="O que a diretoria precisa saber" brand={brand} />
        <View style={{ borderLeftWidth: 3, borderLeftColor: brand, paddingLeft: 14, paddingVertical: 2 }}>
          <Text style={{ fontFamily: "Times-Bold", fontSize: 15, color: C.ink, lineHeight: 1.3 }}>{summary.headline}</Text>
        </View>
        <View style={{ marginTop: 12 }}>
          {summary.bullets.map((b) => (
            <View key={b} style={{ flexDirection: "row", marginBottom: 5 }}>
              <Text style={{ width: 12, color: brand }}>•</Text>
              <Text style={[s.lead, { flex: 1 }]}>{b}</Text>
            </View>
          ))}
        </View>

        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={s.kpiValue}>{data.totals.active}</Text>
            <Text style={s.kpiLabel}>Candidatos ativos</Text>
            <Text style={s.kpiNote}>{data.totals.total - data.totals.active} reprovado(s) fora da conta</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiValue}>{num(data.totals.meetsPct, 0)}%</Text>
            <Text style={s.kpiLabel}>Atendem o mínimo</Text>
            <Text style={s.kpiNote}>{data.totals.meetsMinimum} de {data.totals.analyzed} · corte {data.job.aiMinScore}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiValue}>{st ? num(st.mean) : "—"}</Text>
            <Text style={s.kpiLabel}>Nota média</Text>
            <Text style={s.kpiNote}>{st ? `mediana ${num(st.median)} · desvio ${num(st.stdDev)}` : "sem análises"}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiValue}>{data.avgWaitDays === null ? "—" : num(data.avgWaitDays, 1)}</Text>
            <Text style={s.kpiLabel}>Dias de espera</Text>
            <Text style={s.kpiNote}>média de quem está em triagem</Text>
          </View>
        </View>

        {finalists.length > 0 && (
          <View style={{ marginTop: 22 }}>
            <Text style={s.h2}>Candidatos recomendados</Text>
            {finalists.map((f) => (
              <View key={f.id} style={s.row}>
                <Text style={{ width: 22, fontFamily: "Times-Bold", fontSize: 14, color: brand }}>{f.position}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink, fontSize: 10.5 }}>{f.name}</Text>
                  <Text style={s.small}>
                    {[f.aiProfile, f.aiLevel].filter(Boolean).join(" · ") || "Perfil não identificado"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontFamily: "Times-Bold", fontSize: 16, color: C.ink }}>{num(f.index)}</Text>
                  <Text style={s.small}>índice de decisão</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </PageFrame>

      {/* Panorama */}
      <PageFrame data={data} company={company}>
        <SectionTitle eyebrow="02 · Panorama" title="Como o grupo se distribui" brand={brand} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 28 }}>
          <Donut data={data.stage.map((x) => ({ label: STAGE_LABEL[x.status], value: x.count, color: stageColors[x.status] }))} />
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>Etapa do processo</Text>
            {data.stage.map((x) => (
              <View key={x.status} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: stageColors[x.status], marginRight: 8 }} />
                <Text style={{ flex: 1, color: C.ink }}>{STAGE_LABEL[x.status]}</Text>
                <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink }}>{x.count}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.rule} />
        <Text style={s.h2}>Distribuição das notas da triagem</Text>
        <Text style={[s.small, { marginBottom: 8 }]}>
          Quantos candidatos ativos em cada faixa de nota. Barras escuras estão acima do corte da vaga ({data.job.aiMinScore} pontos); a faixa que contém o corte aparece em tom intermediário.
        </Text>
        <Histogram data={data} brand={brand} />

        <View style={s.rule} />
        <Text style={s.h2}>Medidas estatísticas</Text>
        <Text style={[s.small, { marginBottom: 6 }]}>
          Faixa azulada = 50% do grupo (do 1º ao 3º quartil). Traço grosso = mediana. Ponto preto = média. Linha tracejada = corte.
        </Text>
        <RangeBar data={data} brand={brand} />
        {st && (
          <View style={{ flexDirection: "row", marginTop: 10 }}>
            {[
              ["Mínima", num(st.min, 0)],
              ["1º quartil", num(st.q1)],
              ["Mediana", num(st.median)],
              ["Média", num(st.mean)],
              ["3º quartil", num(st.q3)],
              ["Máxima", num(st.max, 0)],
              ["Desvio-padrão", num(st.stdDev)],
            ].map(([k, v]) => (
              <View key={k} style={{ flex: 1 }}>
                <Text style={s.th}>{k}</Text>
                <Text style={{ fontFamily: "Times-Bold", fontSize: 14, color: C.ink, marginTop: 3 }}>{v}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={[s.small, { marginTop: 12 }]}>
          Um desvio-padrão alto indica um grupo heterogêneo (há candidatos muito acima e muito abaixo); baixo indica
          candidatos parecidos entre si, caso em que os critérios de desempate pesam mais.
        </Text>
      </PageFrame>

      {/* Comparativo */}
      <PageFrame data={data} company={company}>
        <SectionTitle eyebrow="03 · Comparativo" title="Candidatos lado a lado" brand={brand} />
        <Text style={[s.small, { marginBottom: 8 }]}>
          Barra = nota da triagem (colorida quando atende o corte). Losango = índice de decisão. Tracejado vermelho = corte da vaga;
          pontilhado âmbar = nota média do grupo. Valores à direita: nota · índice.
        </Text>
        {compared.length > 0 ? <ScoreBars rows={compared} data={data} brand={brand} /> : <Text style={s.small}>Sem candidatos analisados.</Text>}

        <View style={{ marginTop: 14 }}>
          <View style={[s.row, { borderBottomColor: C.ink }]}>
            <Text style={[s.th, { width: 22 }]}>#</Text>
            <Text style={[s.th, { flex: 1 }]}>Candidato</Text>
            <Text style={[s.th, { width: 50, textAlign: "right" }]}>Nota</Text>
            <Text style={[s.th, { width: 72, textAlign: "right" }]}>Cobertura</Text>
            <Text style={[s.th, { width: 44, textAlign: "right" }]}>Índice</Text>
            <Text style={[s.th, { width: 62, textAlign: "right" }]}>Percentil</Text>
            <Text style={[s.th, { width: 58, textAlign: "right" }]}>vs. corte</Text>
          </View>
          {compared.map((r) => (
            <View key={r.id} style={s.row} wrap={false}>
              <Text style={{ width: 22, fontFamily: "Helvetica-Bold", color: C.ink }}>{r.position}</Text>
              <Text style={{ flex: 1, color: C.ink }}>{cut(r.name, 30)}</Text>
              <Text style={{ width: 50, textAlign: "right" }}>{num(r.aiScore ?? 0, 0)}</Text>
              <Text style={{ width: 72, textAlign: "right" }}>{r.coverage === null ? "—" : `${num(r.coverage, 0)}%`}</Text>
              <Text style={{ width: 44, textAlign: "right", fontFamily: "Helvetica-Bold", color: C.ink }}>{num(r.index)}</Text>
              <Text style={{ width: 62, textAlign: "right" }}>{num(r.percentile, 0)}º</Text>
              <Text style={{ width: 58, textAlign: "right", color: r.gapToCutoff >= 0 ? C.good : C.bad }}>
                {r.gapToCutoff >= 0 ? "+" : ""}
                {num(r.gapToCutoff, 0)}
              </Text>
            </View>
          ))}
        </View>
        {data.ranking.length > compared.length && (
          <Text style={[s.small, { marginTop: 8 }]}>
            Exibidos os {compared.length} primeiros de {data.ranking.length} candidatos ranqueados.
          </Text>
        )}
      </PageFrame>

      {/* Critérios */}
      {criteria.length > 0 && heat.length > 0 && (
        <PageFrame data={data} company={company}>
          <SectionTitle eyebrow="04 · Aderência" title="Critérios da vaga, um a um" brand={brand} />
          <Text style={[s.small, { marginBottom: 10 }]}>
            Cada coluna é um critério definido para a vaga. A cobertura soma 1 ponto por critério atendido e meio ponto por
            critério atendido em parte, dividido pelo total de critérios.
          </Text>
          <Heatmap rows={heat} criteria={criteria} brand={brand} />
          <View style={{ marginTop: 16 }}>
            {criteria.map((c, i) => (
              <View key={c} style={{ flexDirection: "row", marginBottom: 4 }}>
                <Text style={{ width: 26, fontFamily: "Helvetica-Bold", color: brand }}>{`C${i + 1}`}</Text>
                <Text style={{ flex: 1, color: C.ink }}>{c}</Text>
              </View>
            ))}
            {data.job.criteria.length > criteria.length && (
              <Text style={s.small}>+ {data.job.criteria.length - criteria.length} critério(s) não exibido(s).</Text>
            )}
          </View>
        </PageFrame>
      )}

      {/* Fichas de cada candidato: avaliação como registrada, sem reescrever */}
      {data.ranking.length + data.unranked.length > 0 && (
        <PageFrame data={data} company={company}>
          <SectionTitle eyebrow="05 · Fichas" title="Cada candidato, em resumo" brand={brand} />
          <Text style={[s.small, { marginBottom: 12 }]}>
            Avaliação da triagem exatamente como está registrada no sistema: a leitura da IA e, critério por critério, o que foi
            encontrado no currículo. Os candidatos seguem a ordem do ranking; quem ainda não foi analisado vem ao final.
          </Text>
          {data.ranking.map((c) => (
            <CandidateSheet key={c.id} c={c} brand={brand} note={notes?.[c.id]} />
          ))}
          {data.unranked.map((c) => (
            <CandidateSheet key={c.id} c={c} brand={brand} />
          ))}
        </PageFrame>
      )}

      {/* Metodologia */}
      <PageFrame data={data} company={company}>
        <SectionTitle eyebrow="06 · Método" title="Como os números foram calculados" brand={brand} />
        <Text style={s.h2}>Índice de decisão</Text>
        <Text style={s.lead}>
          Índice = {num(INDEX_WEIGHTS.score * 100, 0)}% × nota da triagem + {num(INDEX_WEIGHTS.coverage * 100, 0)}% × cobertura dos
          critérios. A nota da triagem (0 a 100) vem da leitura do currículo contra os requisitos da vaga. A cobertura mede quantos
          critérios foram atendidos (atende = 1, em parte = 0,5, não encontrado = 0). Candidatos sem análise ficam fora do ranking. Quem atende o corte da vaga ({data.job.aiMinScore} pontos) vem sempre antes de quem não atende; dentro de cada grupo, vale o índice.
        </Text>
        <Text style={[s.h2, { marginTop: 14 }]}>Medidas de comparação</Text>
        <Text style={s.lead}>
          Percentil: parcela do grupo com nota abaixo da do candidato, contando metade dos empatados. Desvio-padrão: amostral
          (n-1). Quartis: interpolação linear. Distância ao corte: nota menos a nota mínima definida para a vaga
          ({data.job.aiMinScore} pontos). Margem: diferença de índice entre o 1º e o 2º colocado.
        </Text>
        <Text style={[s.h2, { marginTop: 14 }]}>O que este relatório não faz</Text>
        <Text style={s.lead}>
          O índice é um auxílio à decisão, não um veredito. Ele não considera entrevista, referências, comportamento nem
          cultura da equipe. Não foram usados idade, sexo, estado civil, filhos, deficiência nem foto. Notas e textos de
          apoio foram gerados com apoio de inteligência artificial a partir do currículo; confirme os pontos de atenção com
          o candidato antes de decidir.
        </Text>
        <Text style={[s.h2, { marginTop: 14 }]}>Próximos passos sugeridos</Text>
        {[
          finalists.length >= 2 && data.margin !== null && data.margin < 3
            ? `Entrevistar ${finalists[0].name} e ${finalists[1].name}, pois a diferença entre eles é pequena.`
            : finalists[0]
              ? `Entrevistar ${finalists[0].name}, primeiro colocado, e manter ${finalists[1] ? finalists[1].name : "o próximo da lista"} como alternativa.`
              : "Concluir a análise dos candidatos pendentes.",
          "Confirmar disponibilidade, pretensão salarial e os pontos de atenção na entrevista.",
          "Registrar a decisão e comunicar os demais candidatos.",
        ].map((t) => (
          <View key={t} style={{ flexDirection: "row", marginBottom: 5 }}>
            <Text style={{ width: 12, color: brand }}>•</Text>
            <Text style={[s.lead, { flex: 1 }]}>{t}</Text>
          </View>
        ))}
      </PageFrame>
    </Document>
  );
}
