import { Document, G, Line, Page, Rect, Svg, Text, View } from "@react-pdf/renderer";

import { C, CriteriaBars, Donut, STAGE_LABEL, SvgText, cut, num, s } from "@/components/report/report-kit";
import {
  INDEX_WEIGHTS,
  criteriaSummary,
  executiveSummary,
  type RankedCandidate,
  type ReportData,
} from "@/server/models/report.model";

/** Texto comparativo da IA para um finalista (opcional: o relatório funciona sem ele). */
export type FinalistNote = { reason: string; strengths: string[]; concerns: string[] };

const MET_COLOR = { sim: C.good, parcial: "#e0a526", não: "#e7c7c7" } as const;

/** Notas por faixa, com a linha do corte da vaga. */
function Histogram({ data, brand, width, height }: { data: ReportData; brand: string; width: number; height: number }) {
  const padL = 4;
  const padB = 22;
  const padT = 20;
  const plotW = width - padL * 2;
  const plotH = height - padB - padT;
  const max = Math.max(1, ...data.bands.map((b) => b.count));
  const bw = plotW / data.bands.length;
  const min = data.job.aiMinScore;
  const cutX = padL + (min / 100) * plotW;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line x1={padL} y1={padT + plotH} x2={width - padL} y2={padT + plotH} stroke={C.rule} strokeWidth={1} />
      {data.bands.map((b, i) => {
        const h = (b.count / max) * plotH;
        const x = padL + i * bw + bw * 0.18;
        const above = b.from >= min;
        const straddles = !above && b.to >= min;
        return (
          <G key={b.label}>
            <Rect x={x} y={padT + plotH - h} width={bw * 0.64} height={h} fill={above || straddles ? brand : "#d6d3d1"} opacity={straddles ? 0.45 : 1} />
            <SvgText x={x + bw * 0.32} y={padT + plotH - h - 4} textAnchor="middle" fontSize={9} fill={C.ink}>
              {String(b.count)}
            </SvgText>
            <SvgText x={x + bw * 0.32} y={height - 7} textAnchor="middle" fontSize={7} fill={C.muted}>
              {b.label}
            </SvgText>
          </G>
        );
      })}
      <Line x1={cutX} y1={10} x2={cutX} y2={padT + plotH} stroke={C.bad} strokeWidth={1} strokeDasharray="3 3" />
      <SvgText x={cutX + 3} y={10} fontSize={7} fill={C.bad}>
        {`corte ${min}`}
      </SvgText>
    </Svg>
  );
}

/** Página A4 com rodapé e número de página. */
function Sheet({ footer, children }: { footer: string; children: React.ReactNode }) {
  return (
    <Page size="A4" style={{ fontFamily: "Helvetica", fontSize: 9.5, color: C.text, paddingBottom: 56 }}>
      {children}
      <View style={s.footer} fixed>
        <Text>{footer}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}

const body = { paddingHorizontal: 48 } as const;

/** Uma linha do comparativo: nota com barra e corte, pontos por critério, cobertura e índice. */
function CompareRow({
  r,
  criteria,
  cutoff,
  brand,
}: {
  r: RankedCandidate;
  criteria: string[];
  cutoff: number;
  brand: string;
}) {
  const meets = (r.aiScore ?? 0) >= cutoff;
  return (
    <View style={s.row} wrap={false}>
      <Text style={{ width: 20, fontFamily: "Times-Bold", fontSize: 12, color: meets ? brand : C.muted }}>{r.position}</Text>
      <View style={{ flex: 1, paddingRight: 6 }}>
        <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink, fontSize: 9 }}>{cut(r.name, 28)}</Text>
        <Text style={{ fontSize: 7, color: C.muted }}>
          {cut([r.aiProfile, r.aiLevel].filter(Boolean).join(" · ") || "Perfil não identificado", 34)} · {STAGE_LABEL[r.status] ?? r.status}
        </Text>
      </View>
      <View style={{ width: 118, flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: 90, height: 8, backgroundColor: "#f1f0ee", borderRadius: 2 }}>
          <View style={{ width: `${Math.max(0, Math.min(100, r.aiScore ?? 0))}%`, height: 8, backgroundColor: meets ? brand : "#a8a29e", borderRadius: 2 }} />
          <View style={{ position: "absolute", left: `${cutoff}%`, top: -2, width: 1, height: 12, backgroundColor: C.bad }} />
        </View>
        <Text style={{ width: 28, textAlign: "right", fontFamily: "Helvetica-Bold", color: C.ink }}>{num(r.aiScore ?? 0, 0)}</Text>
      </View>
      <View style={{ width: 94, paddingLeft: 10, flexDirection: "row" }}>
        {criteria.map((crit, ci) => {
          const met = r.criteria.find((k) => k.criterion === crit)?.met;
          return (
            <View
              key={ci}
              style={{ width: 8, height: 8, borderRadius: 2, marginRight: 2, backgroundColor: met ? MET_COLOR[met] : "#f1f0ee" }}
            />
          );
        })}
      </View>
      <Text style={{ width: 46, textAlign: "right" }}>{r.coverage === null ? "—" : `${num(r.coverage, 0)}%`}</Text>
      <Text style={{ width: 38, textAlign: "right", fontFamily: "Helvetica-Bold", color: C.ink }}>{num(r.index)}</Text>
      <Text style={{ width: 40, textAlign: "right", color: r.gapToCutoff >= 0 ? C.good : C.bad }}>
        {r.gapToCutoff >= 0 ? "+" : ""}
        {num(r.gapToCutoff, 0)}
      </Text>
    </View>
  );
}

/* ─── documento ────────────────────────────────────────── */

/** Relatório de decisão da vaga: painel de 1 página + comparativo de 1 página, para ler de relance. */
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
  const footerText = `Confidencial · ${company} · ${cut(data.job.title, 40)}${data.job.code ? ` #${data.job.code}` : ""}`;
  const summary = executiveSummary(data);
  const finalists = data.ranking.slice(0, 3);
  const compared = data.ranking.slice(0, 12);
  const criteria = data.job.criteria.slice(0, 8);
  const critRows = criteriaSummary(data).slice(0, 6);
  const date = data.generatedAt.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const jobLabel = `${data.job.title}${data.job.code ? ` #${data.job.code}` : ""}`;
  const st = data.stats;
  const leader = data.ranking[0];

  const stageColors: Record<string, string> = { PENDING: "#e0a526", SHORTLISTED: "#5b8bd0", INTERVIEW: brand, APPROVED: C.good, REJECTED: "#d6d3d1" };

  const kpis: [string, string, string][] = [
    [String(data.totals.active), "Candidatos ativos", `${data.totals.total - data.totals.active} reprovado(s)`],
    [`${num(data.totals.meetsPct, 0)}%`, "Atendem o mínimo", `${data.totals.meetsMinimum} de ${data.totals.analyzed} · corte ${data.job.aiMinScore}`],
    [st ? num(st.mean) : "—", "Nota média", st ? `mediana ${num(st.median)}` : "sem análises"],
    [leader ? num(leader.index) : "—", "Melhor índice", data.margin !== null ? `${num(data.margin)} pt sobre o 2º` : "sem comparação"],
    [data.avgWaitDays === null ? "—" : num(data.avgWaitDays, 1), "Dias de espera", "média em triagem"],
  ];

  const nextSteps = [
    finalists.length >= 2 && data.margin !== null && data.margin < 3
      ? `Entrevistar ${finalists[0].name} e ${finalists[1].name}: a diferença entre eles é pequena.`
      : finalists[0]
        ? `Entrevistar ${finalists[0].name}, primeiro colocado, e manter ${finalists[1] ? finalists[1].name : "o próximo da lista"} como alternativa.`
        : "Concluir a análise dos candidatos pendentes.",
    "Confirmar disponibilidade, pretensão salarial e pontos de atenção na entrevista.",
    "Registrar a decisão e comunicar os demais candidatos.",
  ];

  return (
    <Document title={`Relatório de decisão — ${jobLabel}`} author={company} subject="Comparativo de candidatos">
      {/* Página 1: painel */}
      <Sheet footer={footerText}>
        <View style={{ backgroundColor: brand, paddingHorizontal: 48, paddingTop: 26, paddingBottom: 18 }}>
          <Text style={{ fontSize: 8, letterSpacing: 2, color: "#ffffff", opacity: 0.8, textTransform: "uppercase", fontFamily: "Helvetica-Bold" }}>
            {company} · Relatório de decisão
          </Text>
          <Text style={{ fontFamily: "Times-Bold", fontSize: 22, color: "#ffffff", marginTop: 6 }}>{jobLabel}</Text>
          <Text style={{ fontSize: 8.5, color: "#ffffff", opacity: 0.85, marginTop: 4 }}>
            {date} · {data.totals.total} candidato(s) no processo · para a diretoria
          </Text>
        </View>

        <View style={[body, { marginTop: 14 }]}>
          <View style={{ borderLeftWidth: 3, borderLeftColor: brand, paddingLeft: 12 }}>
            <Text style={{ fontFamily: "Times-Bold", fontSize: 13, color: C.ink, lineHeight: 1.3 }}>{summary.headline}</Text>
            {summary.bullets[0] ? <Text style={{ fontSize: 9, color: C.text, marginTop: 3 }}>{summary.bullets[0]}</Text> : null}
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            {kpis.map(([value, label, note]) => (
              <View key={label} style={[s.kpi, { padding: 8 }]}>
                <Text style={[s.kpiValue, { fontSize: 19 }]}>{value}</Text>
                <Text style={[s.kpiLabel, { fontSize: 8 }]}>{label}</Text>
                <Text style={s.kpiNote}>{note}</Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 16, marginTop: 16 }}>
            <View style={{ width: 236 }}>
              <Text style={s.h2}>Etapas do processo</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Donut size={96} data={data.stage.map((x) => ({ label: STAGE_LABEL[x.status], value: x.count, color: stageColors[x.status] }))} />
                <View style={{ flex: 1 }}>
                  {data.stage.map((x) => (
                    <View key={x.status} style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: stageColors[x.status], marginRight: 6 }} />
                      <Text style={{ flex: 1, color: C.ink, fontSize: 8.5 }}>{STAGE_LABEL[x.status]}</Text>
                      <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink, fontSize: 8.5 }}>{x.count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.h2}>Notas da triagem</Text>
              <Histogram data={data} brand={brand} width={247} height={112} />
            </View>
          </View>

          {finalists.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text style={s.h2}>Candidatos recomendados</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {finalists.map((f) => (
                  <View key={f.id} style={{ flex: 1, borderWidth: 0.75, borderColor: C.rule, borderRadius: 6, padding: 9 }} wrap={false}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={{ width: 20, fontFamily: "Times-Bold", fontSize: 18, color: brand }}>{f.position}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink, fontSize: 9 }}>{cut(f.name, 24)}</Text>
                        <Text style={{ fontSize: 7, color: C.muted }}>{cut([f.aiProfile, f.aiLevel].filter(Boolean).join(" · ") || "Perfil não identificado", 28)}</Text>
                      </View>
                    </View>
                    <Text style={{ marginTop: 5, fontSize: 8, color: C.text }}>
                      <Text style={{ fontFamily: "Times-Bold", fontSize: 13, color: C.ink }}>{num(f.index)}</Text>
                      {`  índice · nota ${num(f.aiScore ?? 0, 0)} · cobertura ${f.coverage === null ? "—" : `${num(f.coverage, 0)}%`}`}
                    </Text>
                    <Text style={{ marginTop: 4, fontSize: 7.5, lineHeight: 1.4, color: C.muted }}>
                      {cut((notes?.[f.id]?.reason || f.aiReasoning || "").trim() || "Sem leitura registrada.", 135)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {critRows.length > 0 && data.ranking.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text style={s.h2}>O grupo atende cada critério?</Text>
              <CriteriaBars rows={critRows} />
              {critRows.some((r) => r.scarce) && (
                <Text style={[s.small, { marginTop: 4, color: C.bad }]}>
                  Escasso (menos de 1/3 atende): {critRows.filter((r) => r.scarce).map((r) => cut(r.criterion, 36)).join("; ")}.
                </Text>
              )}
            </View>
          )}
        </View>
      </Sheet>

      {/* Página 2: comparativo */}
      <Sheet footer={footerText}>
        <View style={[body, { paddingTop: 40 }]}>
          <Text style={[s.eyebrow, { color: brand }]}>Comparativo</Text>
          <Text style={[s.h1, { fontSize: 20, marginBottom: 4 }]}>Candidatos lado a lado</Text>
          <Text style={[s.small, { marginBottom: 10 }]}>
            Barra = nota da triagem (colorida quando atende o corte; traço vermelho = corte {data.job.aiMinScore}). Pontos = critérios da vaga, na ordem da
            legenda. Índice = {num(INDEX_WEIGHTS.score * 100, 0)}% nota + {num(INDEX_WEIGHTS.coverage * 100, 0)}% cobertura.
          </Text>

          {compared.length > 0 ? (
            <View>
              <View style={[s.row, { borderBottomColor: C.ink }]}>
                <Text style={[s.th, { width: 20 }]}>#</Text>
                <Text style={[s.th, { flex: 1 }]}>Candidato</Text>
                <Text style={[s.th, { width: 118 }]}>Nota</Text>
                <Text style={[s.th, { width: 94, paddingLeft: 10 }]}>Critérios</Text>
                <Text style={[s.th, { width: 46, textAlign: "right" }]}>Cobert.</Text>
                <Text style={[s.th, { width: 38, textAlign: "right" }]}>Índice</Text>
                <Text style={[s.th, { width: 40, textAlign: "right" }]}>Corte</Text>
              </View>
              {compared.map((r) => (
                <CompareRow key={r.id} r={r} criteria={criteria} cutoff={data.job.aiMinScore} brand={brand} />
              ))}
            </View>
          ) : (
            <Text style={s.small}>Sem candidatos analisados.</Text>
          )}
          {(data.ranking.length > compared.length || data.unranked.length > 0) && (
            <Text style={[s.small, { marginTop: 6 }]}>
              {data.ranking.length > compared.length ? `Exibidos os ${compared.length} primeiros de ${data.ranking.length} ranqueados. ` : ""}
              {data.unranked.length > 0 ? `${data.unranked.length} candidato(s) ainda sem análise ficaram fora do ranking.` : ""}
            </Text>
          )}

          {criteria.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text style={s.h2}>Legenda dos critérios</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {criteria.map((c, i) => (
                  <View key={c} style={{ width: "50%", flexDirection: "row", marginBottom: 3, paddingRight: 8 }}>
                    <Text style={{ width: 22, fontFamily: "Helvetica-Bold", color: brand, fontSize: 8 }}>{`C${i + 1}`}</Text>
                    <Text style={{ flex: 1, color: C.ink, fontSize: 8 }}>{cut(c, 52)}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: "row", marginTop: 4 }}>
                {[
                  [C.good, "atende"],
                  ["#e0a526", "em parte"],
                  ["#e7c7c7", "não encontrado"],
                  ["#f1f0ee", "sem análise"],
                ].map(([color, label]) => (
                  <View key={label} style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color, marginRight: 4 }} />
                    <Text style={{ fontSize: 7.5, color: C.muted }}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={{ marginTop: 16 }}>
            <Text style={s.h2}>Próximos passos sugeridos</Text>
            {nextSteps.map((t) => (
              <View key={t} style={{ flexDirection: "row", marginBottom: 3 }}>
                <Text style={{ width: 12, color: brand }}>•</Text>
                <Text style={{ flex: 1, fontSize: 9, lineHeight: 1.45 }}>{t}</Text>
              </View>
            ))}
          </View>

          <Text style={[s.small, { marginTop: 14 }]}>
            Como ler: o índice é um auxílio à decisão, não um veredito; não considera entrevista, referências nem cultura da equipe. Quem atende o corte vem sempre
            antes de quem não atende. Cobertura: atende = 1, em parte = 0,5, não encontrado = 0. Notas geradas com apoio de inteligência artificial a partir do
            currículo; idade, sexo, estado civil, deficiência e foto não foram usados. Documento confidencial (LGPD): use só para esta seleção.
          </Text>
        </View>
      </Sheet>
    </Document>
  );
}
