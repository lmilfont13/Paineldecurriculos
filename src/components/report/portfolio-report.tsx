// Relatório geral de recrutamento (PDF): como cada vaga está e qual o perfil dos candidatos.
import { Circle, Document, Page, Svg, Text, View } from "@react-pdf/renderer";

import { Columns, HBars, MiniHistogram, StackedBars } from "@/components/report/portfolio-charts";
import { C, CriteriaBars, Donut, PageFrame, STAGE_LABEL, SectionTitle, cut, num, s } from "@/components/report/report-kit";
import { portfolioInsights, type Portfolio } from "@/server/models/portfolio.model";

const MAX_FICHAS = 8;

const jobLabel = (j: { title: string; code: string | null }) => `${j.title}${j.code ? ` #${j.code}` : ""}`;
const dayLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const STATUS_LABEL: Record<string, string> = { OPEN: "Aberta", PAUSED: "Pausada", DRAFT: "Rascunho", CLOSED: "Encerrada" };

function Kpi({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiValue}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiNote}>{note}</Text>
    </View>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 8, height: 8, backgroundColor: i.color }} />
          <Text style={s.small}>{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function PortfolioReport({
  data,
  company,
  brand = "#7a1f3d",
}: {
  data: Portfolio;
  company: string;
  brand?: string;
}) {
  const t = data.totals;
  const insights = portfolioInsights(data);
  const footerText = `Confidencial · ${company} · Relatório geral de recrutamento`;
  const date = data.generatedAt.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const stageColors: Record<string, string> = { PENDING: "#e0a526", INTERVIEW: brand, APPROVED: C.good, REJECTED: "#d6d3d1" };
  const jobs = data.perJob;
  const fichas = jobs.filter((j) => j.total > 0).slice(0, MAX_FICHAS);
  const p = data.profile;
  const trend = t.last7 - t.previous7;

  return (
    <Document title="Relatório geral de recrutamento" author={company} subject="Vagas e perfil dos candidatos">
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
            Relatório geral{"\n"}de recrutamento
          </Text>
          <Text style={{ fontFamily: "Times-Roman", fontSize: 18, color: "#ffffff", opacity: 0.9, marginTop: 18 }}>
            Vagas e perfil dos candidatos
          </Text>
        </View>
        <View style={{ paddingHorizontal: 56, paddingTop: 36 }}>
          <View style={{ flexDirection: "row", gap: 40 }}>
            <View>
              <Text style={s.eyebrow}>Emitido em</Text>
              <Text style={{ fontSize: 11, color: C.ink, marginTop: 4 }}>{date}</Text>
            </View>
            <View>
              <Text style={s.eyebrow}>Vagas abertas</Text>
              <Text style={{ fontSize: 11, color: C.ink, marginTop: 4 }}>{t.jobs.open}</Text>
            </View>
            <View>
              <Text style={s.eyebrow}>Candidatos</Text>
              <Text style={{ fontSize: 11, color: C.ink, marginTop: 4 }}>
                {t.people} pessoa(s) · {t.applications} candidatura(s)
              </Text>
            </View>
          </View>
          <View style={[s.rule, { marginVertical: 22 }]} />
          <Text style={s.small}>
            Documento confidencial. Contém dados pessoais de candidatos, protegidos pela LGPD: use apenas para a gestão
            das seleções e não encaminhe a terceiros.
          </Text>
        </View>
      </Page>

      {/* Resumo */}
      <PageFrame footer={footerText}>
        <SectionTitle eyebrow="01 · Resumo" title="Como está o recrutamento" brand={brand} />
        <View style={{ borderLeftWidth: 3, borderLeftColor: brand, paddingLeft: 14, paddingVertical: 2 }}>
          <Text style={{ fontFamily: "Times-Bold", fontSize: 15, color: C.ink, lineHeight: 1.3 }}>
            {t.jobs.open} vaga(s) aberta(s) e {t.people} candidato(s) no total.
            {t.analyzed > 0 ? ` ${num(t.meetsPct, 0)}% dos analisados atendem o corte da vaga.` : ""}
          </Text>
        </View>
        <View style={{ marginTop: 12 }}>
          {insights.map((b) => (
            <View key={b} style={{ flexDirection: "row", marginBottom: 5 }}>
              <Text style={{ width: 12, color: brand }}>•</Text>
              <Text style={[s.lead, { flex: 1 }]}>{b}</Text>
            </View>
          ))}
        </View>

        <View style={s.kpiRow}>
          <Kpi value={String(t.jobs.open)} label="Vagas abertas" note={`${t.jobs.paused} pausada(s) · ${t.jobs.closed} encerrada(s)`} />
          <Kpi value={String(t.people)} label="Pessoas" note={`${t.applications} candidatura(s) no total`} />
          <Kpi value={`${num(t.meetsPct, 0)}%`} label="Atendem o corte" note={`${t.meets} de ${t.analyzed} analisados`} />
          <Kpi value={t.avgWaitDays === null ? "—" : num(t.avgWaitDays, 1)} label="Dias de espera" note="média de quem está em triagem" />
        </View>
        <View style={s.kpiRow}>
          <Kpi value={String(t.last7)} label="Novos em 7 dias" note={`${trend >= 0 ? "+" : "-"}${Math.abs(trend)} frente aos 7 anteriores`} />
          <Kpi value={String(t.active)} label="Ativos" note="candidaturas não reprovadas" />
        </View>

        <View style={{ flexDirection: "row", gap: 24, marginTop: 24, alignItems: "center" }}>
          <Donut data={data.stage.map((x) => ({ label: STAGE_LABEL[x.status], value: x.count, color: stageColors[x.status] }))} />
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>Em que etapa estão</Text>
            {data.stage.map((x) => (
              <View key={x.status} style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <View style={{ width: 8, height: 8, backgroundColor: stageColors[x.status], marginRight: 6 }} />
                <Text style={{ flex: 1, fontSize: 9.5 }}>{STAGE_LABEL[x.status]}</Text>
                <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink }}>{x.count}</Text>
              </View>
            ))}
            <Text style={[s.small, { marginTop: 4 }]}>Considera só as vagas em andamento.</Text>
          </View>
        </View>
      </PageFrame>

      {/* Panorama das vagas */}
      <PageFrame footer={footerText}>
        <SectionTitle eyebrow="02 · Panorama" title="Cada vaga, lado a lado" brand={brand} />
        {jobs.length === 0 ? (
          <Text style={s.lead}>Nenhuma vaga em andamento.</Text>
        ) : (
          <>
            <View style={[s.row, { borderBottomColor: C.ink }]}>
              <Text style={[s.th, { flex: 1 }]}>Vaga</Text>
              <Text style={[s.th, { width: 52 }]}>Situação</Text>
              <Text style={[s.th, { width: 40, textAlign: "right" }]}>Cand.</Text>
              <Text style={[s.th, { width: 40, textAlign: "right" }]}>7 dias</Text>
              <Text style={[s.th, { width: 44, textAlign: "right" }]}>Média</Text>
              <Text style={[s.th, { width: 52, textAlign: "right" }]}>No corte</Text>
            </View>
            {jobs.map((j) => (
              <View key={j.job.id} style={s.row} wrap={false}>
                <Text style={{ flex: 1, color: C.ink, fontFamily: "Helvetica-Bold" }}>{cut(jobLabel(j.job), 44)}</Text>
                <Text style={{ width: 52, fontSize: 8.5 }}>{STATUS_LABEL[j.job.status]}</Text>
                <Text style={{ width: 40, textAlign: "right" }}>{j.total}</Text>
                <Text style={{ width: 40, textAlign: "right" }}>{j.last7}</Text>
                <Text style={{ width: 44, textAlign: "right" }}>{j.report.stats ? num(j.report.stats.mean, 0) : "—"}</Text>
                <Text style={{ width: 52, textAlign: "right", color: j.report.totals.meetsPct >= 50 ? C.good : C.text }}>
                  {j.report.totals.analyzed ? `${num(j.report.totals.meetsPct, 0)}%` : "—"}
                </Text>
              </View>
            ))}

            <Text style={[s.h2, { marginTop: 24 }]}>Funil por vaga</Text>
            <StackedBars
              rows={jobs.map((j) => ({
                label: jobLabel(j.job),
                parts: j.report.stage.map((x) => ({ value: x.count, color: stageColors[x.status] })),
              }))}
            />
            <Legend items={data.stage.map((x) => ({ label: STAGE_LABEL[x.status], color: stageColors[x.status] }))} />
          </>
        )}
      </PageFrame>

      {/* Qualidade por vaga */}
      <PageFrame footer={footerText}>
        <SectionTitle eyebrow="03 · Qualidade" title="Quão boas são as candidaturas" brand={brand} />
        <Text style={[s.lead, { marginBottom: 12 }]}>
          Distribuição das notas da triagem em cada vaga. A linha tracejada é o corte de aprovação.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {jobs.slice(0, 8).map((j) => (
            <View key={j.job.id} style={{ width: 240 }} wrap={false}>
              <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink, fontSize: 9.5 }}>{cut(jobLabel(j.job), 38)}</Text>
              <Text style={[s.small, { marginBottom: 4 }]}>
                {j.report.stats
                  ? `média ${num(j.report.stats.mean, 0)} · mediana ${num(j.report.stats.median, 0)} · ${num(j.report.totals.meetsPct, 0)}% no corte`
                  : "sem candidatos analisados"}
              </Text>
              <MiniHistogram bands={j.report.bands} cutoff={j.job.aiMinScore} color={brand} />
            </View>
          ))}
        </View>
      </PageFrame>

      {/* Evolução */}
      <PageFrame footer={footerText}>
        <SectionTitle eyebrow="04 · Evolução" title="Candidaturas nos últimos 30 dias" brand={brand} />
        <Columns data={data.timeline.map((d) => ({ label: dayLabel(d.date), value: d.count }))} color={brand} />
        <Text style={[s.small, { marginTop: 6 }]}>
          Últimos 7 dias: {t.last7} · 7 dias anteriores: {t.previous7}. Datas no fuso de Fortaleza.
        </Text>

        <Text style={[s.h2, { marginTop: 26 }]}>Pretensão salarial</Text>
        {p.salary.n === 0 ? (
          <Text style={s.lead}>Nenhum candidato informou um valor que o sistema consiga ler.</Text>
        ) : (
          <>
            <Text style={[s.lead, { marginBottom: 8 }]}>
              Mediana R$ {num(p.salary.median ?? 0, 0)} · média R$ {num(p.salary.mean ?? 0, 0)} · {p.salary.n} de {p.people} informaram.
            </Text>
            <HBars rows={p.salary.bands.map((b) => ({ label: b.label, value: b.count }))} total={p.salary.n} color={brand} />
          </>
        )}
      </PageFrame>

      {/* Perfil dos candidatos */}
      <PageFrame footer={footerText}>
        <SectionTitle eyebrow="05 · Perfil" title="Quem são os candidatos" brand={brand} />
        <View style={{ flexDirection: "row", gap: 24 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>Nível de experiência</Text>
            <HBars rows={p.levels.map((x) => ({ label: x.label, value: x.count }))} total={p.people} color={brand} width={235} labelW={80} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>Disponibilidade</Text>
            <HBars rows={p.availability.map((x) => ({ label: x.label, value: x.count }))} total={p.people} color={brand} width={235} labelW={80} />
          </View>
        </View>
        <Text style={[s.h2, { marginTop: 18 }]}>Áreas de atuação</Text>
        <HBars rows={p.areas.map((x) => ({ label: x.label, value: x.count }))} total={p.people} color={brand} />
        <Text style={[s.h2, { marginTop: 14 }]}>Perfis profissionais</Text>
        <HBars rows={p.roles.map((x) => ({ label: x.label, value: x.count }))} total={p.people} color={brand} />
        <Text style={[s.h2, { marginTop: 14 }]}>Onde moram</Text>
        <HBars rows={p.places.map((x) => ({ label: x.label, value: x.count }))} total={p.people} color={brand} />
        <Text style={[s.small, { marginTop: 10 }]}>
          Com CNH: {p.cnh.with} · sem CNH: {p.cnh.without}
          {p.workPreference.length > 0 ? ` · Preferência: ${p.workPreference.map((x) => `${x.label} (${x.count})`).join(", ")}` : ""}
        </Text>
      </PageFrame>

      {/* Fichas por vaga */}
      {fichas.map((j, i) => {
        const top = j.report.ranking.slice(0, 3);
        return (
          <PageFrame key={j.job.id} footer={footerText}>
            <SectionTitle eyebrow={`06 · Ficha da vaga ${i + 1} de ${fichas.length}`} title={cut(jobLabel(j.job), 46)} brand={brand} />
            <View style={s.kpiRow}>
              <Kpi value={String(j.total)} label="Candidaturas" note={`${j.last7} nos últimos 7 dias`} />
              <Kpi
                value={j.report.stats ? num(j.report.stats.mean, 0) : "—"}
                label="Nota média"
                note={j.report.stats ? `mediana ${num(j.report.stats.median, 0)}` : "sem análises"}
              />
              <Kpi
                value={j.report.totals.analyzed ? `${num(j.report.totals.meetsPct, 0)}%` : "—"}
                label="Atendem o corte"
                note={`corte ${j.job.aiMinScore}`}
              />
              <Kpi
                value={j.report.avgWaitDays === null ? "—" : num(j.report.avgWaitDays, 1)}
                label="Dias de espera"
                note="em triagem"
              />
            </View>

            <Text style={[s.h2, { marginTop: 20 }]}>Critérios da vaga</Text>
            {j.criteria.length === 0 ? (
              <Text style={s.small}>Esta vaga não tem critérios avaliáveis.</Text>
            ) : (
              <CriteriaBars rows={j.criteria.slice(0, 8)} />
            )}

            <Text style={[s.h2, { marginTop: 20 }]}>Melhores candidatos hoje</Text>
            {top.length === 0 ? (
              <Text style={s.small}>Ainda não há candidatos analisados.</Text>
            ) : (
              top.map((c) => (
                <View key={c.id} style={s.row} wrap={false}>
                  <Text style={{ width: 22, fontFamily: "Times-Bold", fontSize: 14, color: brand }}>{c.position}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink, fontSize: 10.5 }}>{c.name}</Text>
                    <Text style={s.small}>{[c.aiProfile, c.aiLevel].filter(Boolean).join(" · ") || "Perfil não identificado"}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontFamily: "Times-Bold", fontSize: 16, color: C.ink }}>{num(c.index)}</Text>
                    <Text style={s.small}>índice de decisão</Text>
                  </View>
                </View>
              ))
            )}
          </PageFrame>
        );
      })}

      {/* Método */}
      <PageFrame footer={footerText}>
        <SectionTitle eyebrow="07 · Método" title="Como os números foram calculados" brand={brand} />
        {[
          "Pessoas: o mesmo e-mail em várias vagas conta como uma pessoa. O perfil usa a candidatura mais recente.",
          "Atendem o corte: candidatos analisados com nota igual ou acima do corte de aprovação da própria vaga.",
          "Índice de decisão: 60% da nota da triagem + 40% da cobertura dos critérios (sim = 1, em parte = 0,5, não = 0).",
          "Pretensão salarial: lida do texto digitado pelo candidato (a primeira cifra entre R$ 300 e R$ 100.000). Quem não informou fica de fora.",
          "Vagas encerradas e candidatos de demonstração não entram nos números de qualidade e etapas.",
          "Idade, sexo, estado civil, deficiência e foto não são usados em nenhum cálculo ou gráfico.",
          "A nota vem da triagem por IA, que apenas sugere: etapa e decisão são sempre da equipe.",
        ].map((line) => (
          <View key={line} style={{ flexDirection: "row", marginBottom: 6 }}>
            <Text style={{ width: 12, color: brand }}>•</Text>
            <Text style={[s.lead, { flex: 1 }]}>{line}</Text>
          </View>
        ))}
        <Text style={[s.small, { marginTop: 14 }]}>Dados até {date}.</Text>
      </PageFrame>
    </Document>
  );
}
