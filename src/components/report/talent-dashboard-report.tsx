// Relatório Executivo em PDF: Dashboard Completo de Talentos & Capital Humano (nível Michelin).
import { Circle, Document, G, Page, Rect, Svg, Text, View } from "@react-pdf/renderer";

import { HBars } from "@/components/report/portfolio-charts";
import { C, Donut, SvgText, cut, num, s } from "@/components/report/report-kit";
import type { TalentDashboardData } from "@/server/models/talent-dashboard.model";

function Kpi({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiValue}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiNote}>{note}</Text>
    </View>
  );
}

function SectionHeader({ eyebrow, title, brand }: { eyebrow: string; title: string; brand: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[s.eyebrow, { color: brand }]}>{eyebrow}</Text>
      <Text style={s.h1}>{title}</Text>
    </View>
  );
}

export function TalentDashboardReport({
  data,
  company,
  brand = "#7a1f3d",
}: {
  data: TalentDashboardData;
  company: string;
  brand?: string;
}) {
  const footerText = `Confidencial · ${company} · Dashboard Executivo de Talentos & Capital Humano`;
  const dateFormatted = data.generatedAt.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const genderDonutData = [
    { label: "Feminino", value: data.gender.female.count, color: "#be185d" },
    { label: "Masculino", value: data.gender.male.count, color: "#1d4ed8" },
    ...(data.gender.unspecified.count > 0
      ? [{ label: "Não informado", value: data.gender.unspecified.count, color: "#94a3b8" }]
      : []),
  ];

  const ageBarRows = data.age.brackets.map((b) => ({
    label: b.label,
    value: b.count,
  }));

  const roleRows = data.roles.map((r) => ({
    label: r.label,
    value: r.count,
  }));

  const companyRows = data.companies.topCompanies.map((c) => ({
    label: c.label,
    value: c.count,
  }));

  const levelRows = data.levels.map((l) => ({
    label: l.label,
    value: l.count,
  }));

  const areaRows = data.areas.map((a) => ({
    label: a.label,
    value: a.count,
  }));

  return (
    <Document
      title={`Dashboard Executivo de Talentos - ${company}`}
      author={company}
      subject="Panorama Demográfico e Inteligência de Mercado"
    >
      {/* ─── PÁGINA 1: CAPA EXECUTIVA MICHELIN ─── */}
      <Page size="A4" style={{ fontFamily: "Helvetica" }}>
        <View style={{ height: 460, backgroundColor: brand, paddingHorizontal: 54, paddingTop: 64 }}>
          <Svg width={595} height={460} viewBox="0 0 595 460" style={{ position: "absolute", right: 0, top: 0 }}>
            <Circle cx={520} cy={60} r={160} fill="#ffffff" opacity={0.07} />
            <Circle cx={430} cy={170} r={90} fill="#ffffff" opacity={0.05} />
            <Circle cx={340} cy={90} r={50} fill="#ffffff" opacity={0.04} />
          </Svg>
          <Text
            style={{
              fontSize: 9.5,
              letterSpacing: 2.8,
              color: "#ffffff",
              opacity: 0.85,
              textTransform: "uppercase",
              fontFamily: "Helvetica-Bold",
            }}
          >
            {company} · Talent Intelligence
          </Text>
          <Text style={{ fontFamily: "Times-Bold", fontSize: 40, color: "#ffffff", marginTop: 140, lineHeight: 1.08 }}>
            Dashboard Executivo{"\n"}de Talentos & CVs
          </Text>
          <Text style={{ fontFamily: "Times-Roman", fontSize: 17, color: "#ffffff", opacity: 0.9, marginTop: 18 }}>
            Panorama demográfico, mercado de trabalho, cargos e histórico de permanência
          </Text>
        </View>

        <View style={{ paddingHorizontal: 54, paddingTop: 36 }}>
          <View style={{ flexDirection: "row", gap: 36 }}>
            <View>
              <Text style={s.eyebrow}>Emitido em</Text>
              <Text style={{ fontSize: 11, color: C.ink, marginTop: 4, fontFamily: "Helvetica-Bold" }}>
                {dateFormatted}
              </Text>
            </View>
            <View>
              <Text style={s.eyebrow}>Total de Candidatos</Text>
              <Text style={{ fontSize: 11, color: C.ink, marginTop: 4, fontFamily: "Helvetica-Bold" }}>
                {data.totals.candidates} talentos mapeados
              </Text>
            </View>
            <View>
              <Text style={s.eyebrow}>Aderência Alta (80%+)</Text>
              <Text style={{ fontSize: 11, color: C.ink, marginTop: 4, fontFamily: "Helvetica-Bold" }}>
                {data.totals.topMatchesCount} ({data.totals.topMatchesPct}%)
              </Text>
            </View>
            <View>
              <Text style={s.eyebrow}>Tempo Médio de Empresa</Text>
              <Text style={{ fontSize: 11, color: C.ink, marginTop: 4, fontFamily: "Helvetica-Bold" }}>
                {data.companies.avgTenureFormatted}
              </Text>
            </View>
          </View>

          <View style={[s.rule, { marginVertical: 24 }]} />

          <Text style={s.small}>
            Documento analítico executivo confidencial gerado pelo Sistema de Triagem e Inteligência de Recrutamento da{" "}
            {company}. As informações e métricas consolidadas respeitam a LGPD e visam orientar o planejamento estratégico de
            atração, retenção e contratações da empresa.
          </Text>
        </View>
      </Page>

      {/* ─── PÁGINA 2: DEMOGRAFIA, GÊNERO & IDADE ─── */}
      <Page size="A4" style={s.page}>
        <SectionHeader
          eyebrow="Panorama Demográfico"
          title="Distribuição por Gênero, Faixa Etária e Perfil"
          brand={brand}
        />

        <Text style={s.lead}>
          Composição demográfica da base de {data.totals.candidates} candidatos da {company}. Métricas calculadas a partir
          dos currículos, documentos e dados autodeclarados no processo seletivo.
        </Text>

        {/* Linha de KPIs Demográficos */}
        <View style={s.kpiRow}>
          <Kpi
            value={`${data.gender.female.pct}%`}
            label="Mulheres (Feminino)"
            note={`${data.gender.female.count} candidatas`}
          />
          <Kpi
            value={`${data.gender.male.pct}%`}
            label="Homens (Masculino)"
            note={`${data.gender.male.count} candidatos`}
          />
          <Kpi
            value={data.age.mean ? `${data.age.mean} anos` : "—"}
            label="Idade Média"
            note={data.age.median ? `Mediana: ${data.age.median} anos` : "Base com datas"}
          />
          <Kpi
            value={data.totals.avgScore !== null ? `${data.totals.avgScore}/100` : "—"}
            label="Score Médio IA"
            note={`${data.totals.analyzed} analisados`}
          />
        </View>

        <View style={[s.rule, { marginVertical: 20 }]} />

        {/* 2 Colunas: Donut de Gênero vs Barras de Idade */}
        <View style={{ flexDirection: "row", gap: 32 }}>
          {/* Coluna Gênero */}
          <View style={{ width: 195 }}>
            <Text style={s.h2}>Divisão por Gênero</Text>
            <Text style={[s.small, { marginBottom: 12 }]}>
              Identificação por pré-classificação nominativa e dados contextuais do currículo.
            </Text>

            <View style={{ alignItems: "center", marginVertical: 10 }}>
              <Donut data={genderDonutData} size={126} />
            </View>

            <View style={{ marginTop: 8, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: "#be185d" }} />
                  <Text style={{ fontSize: 8.5, color: C.ink }}>Feminino</Text>
                </View>
                <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.ink }}>
                  {data.gender.female.count} ({data.gender.female.pct}%)
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: "#1d4ed8" }} />
                  <Text style={{ fontSize: 8.5, color: C.ink }}>Masculino</Text>
                </View>
                <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.ink }}>
                  {data.gender.male.count} ({data.gender.male.pct}%)
                </Text>
              </View>

              {data.gender.unspecified.count > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: "#94a3b8" }} />
                    <Text style={{ fontSize: 8.5, color: C.muted }}>Não informado</Text>
                  </View>
                  <Text style={{ fontSize: 8.5, color: C.muted }}>
                    {data.gender.unspecified.count} ({data.gender.unspecified.pct}%)
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Coluna Faixas Etárias */}
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>Distribuição por Faixas Etárias</Text>
            <Text style={[s.small, { marginBottom: 12 }]}>
              Concentração geracional dos candidatos com data de nascimento ou idade identificada.
            </Text>

            <HBars rows={ageBarRows} total={data.totals.candidates} color="#6366f1" width={270} labelW={80} />

            <View style={{ marginTop: 14, padding: 8, backgroundColor: C.tint, borderRadius: 6, borderWidth: 0.5, borderColor: C.rule }}>
              <Text style={{ fontSize: 8, color: C.text, lineHeight: 1.4 }}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Faixa mais expressiva:</Text>{" "}
                {data.age.brackets[2]?.label || "25 a 34 anos"} com {data.age.brackets[2]?.count || 0} candidatos (
                {data.age.brackets[2]?.pct || 0}%). Menor idade registrada: {data.age.min ?? "—"} anos; maior idade:{" "}
                {data.age.max ?? "—"} anos.
              </Text>
            </View>
          </View>
        </View>

        {/* Qualidade e Completude */}
        <View style={{ marginTop: 24, padding: 12, backgroundColor: C.tint, borderRadius: 6, borderWidth: 0.75, borderColor: C.rule }}>
          <Text style={[s.eyebrow, { marginBottom: 6 }]}>Qualidade e Completude Cadastral</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 8.5, color: C.text }}>
              • Com foto extraída: <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.totals.withPhoto} ({data.totals.withPhotoPct}%)</Text>
            </Text>
            <Text style={{ fontSize: 8.5, color: C.text }}>
              • Com PDF anexado: <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.totals.withPdf} ({data.totals.withPdfPct}%)</Text>
            </Text>
            <Text style={{ fontSize: 8.5, color: C.text }}>
              • Triados pela IA: <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.totals.analyzed} ({data.totals.analyzedPct}%)</Text>
            </Text>
          </View>
        </View>

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text>{footerText}</Text>
          <Text render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ─── PÁGINA 3: INTELIGÊNCIA DE MERCADO (CARGOS, EMPRESAS & SENIORIDADE) ─── */}
      <Page size="A4" style={s.page}>
        <SectionHeader
          eyebrow="Inteligência de Mercado"
          title="Cargos Mais Vistos, Empresas e Experiências"
          brand={brand}
        />

        <Text style={s.lead}>
          Mapeamento das competências de mercado, histórico de passagem pelas empresas e níveis de senioridade
          dos candidatos disponíveis no radar da {company}.
        </Text>

        <View style={s.kpiRow}>
          <Kpi
            value={String(data.roles.length)}
            label="Cargos Mapeados"
            note={`Mais frequente: ${cut(data.roles[0]?.label || "—", 16)}`}
          />
          <Kpi
            value={String(data.companies.totalCompaniesRecorded)}
            label="Empresas no Histórico"
            note={`Top: ${cut(data.companies.topCompanies[0]?.label || "—", 16)}`}
          />
          <Kpi
            value={data.levels[0]?.label || "Pleno"}
            label="Senioridade Predominante"
            note={`${data.levels[0]?.count || 0} candidatos (${data.levels[0]?.pct || 0}%)`}
          />
          <Kpi
            value={data.companies.avgTenureFormatted}
            label="Tempo Médio em Empresas"
            note="Durabilidade e estabilidade"
          />
        </View>

        <View style={[s.rule, { marginVertical: 20 }]} />

        {/* 2 Colunas: Top Cargos vs Top Empresas */}
        <View style={{ flexDirection: "row", gap: 28 }}>
          {/* Top Cargos */}
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>Top Cargos Mais Frequentes</Text>
            <Text style={[s.small, { marginBottom: 10 }]}>Funções e perfis profissionais mais vistos nos currículos.</Text>
            <HBars rows={roleRows.slice(0, 7)} total={data.totals.candidates} color={brand} width={235} labelW={110} />
          </View>

          {/* Top Empresas */}
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>Empresas com Mais Passagens</Text>
            <Text style={[s.small, { marginBottom: 10 }]}>Principais organizações onde os talentos já atuaram.</Text>
            <HBars
              rows={companyRows.length > 0 ? companyRows.slice(0, 7) : [{ label: "Sem registros", value: 0 }]}
              total={data.totals.candidates}
              color="#0d9488"
              width={235}
              labelW={110}
            />
          </View>
        </View>

        <View style={[s.rule, { marginVertical: 20 }]} />

        {/* Níveis de Senioridade e Áreas */}
        <View style={{ flexDirection: "row", gap: 28 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>Níveis de Senioridade</Text>
            <HBars rows={levelRows} total={data.totals.candidates} color="#d97706" width={235} labelW={80} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={s.h2}>Áreas de Atuação Profissional</Text>
            <HBars rows={areaRows} total={data.totals.candidates} color="#2563eb" width={235} labelW={80} />
          </View>
        </View>

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text>{footerText}</Text>
          <Text render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ─── PÁGINA 4: DOSSIÊ DOS PRINCIPAIS TALENTOS (TOP MATCHES) ─── */}
      <Page size="A4" style={s.page}>
        <SectionHeader
          eyebrow="Radar de Excelência"
          title="Ranking dos Principais Talentos da Base"
          brand={brand}
        />

        <Text style={s.lead}>
          Candidatos com maior nota de aderência pela IA e histórico consistente de mercado. Talentos prontos para alocação
          imediata ou banco de sucessão interna na {company}.
        </Text>

        <View style={[s.rule, { marginTop: 12, marginBottom: 10 }]} />

        {/* Cabeçalho da Tabela */}
        <View style={[s.row, { borderBottomWidth: 1, borderBottomColor: C.ink, paddingBottom: 6 }]}>
          <Text style={[s.th, { width: 130 }]}>Candidato</Text>
          <Text style={[s.th, { width: 120 }]}>Cargo / Perfil</Text>
          <Text style={[s.th, { width: 70 }]}>Nível / Idade</Text>
          <Text style={[s.th, { width: 85 }]}>Localização</Text>
          <Text style={[s.th, { width: 50, textAlign: "right" }]}>Score IA</Text>
        </View>

        {/* Linhas da Tabela */}
        {data.highlights.slice(0, 12).map((item, idx) => {
          const scoreColor = (item.score ?? 0) >= 80 ? C.good : (item.score ?? 0) >= 60 ? "#d97706" : C.ink;
          return (
            <View key={item.id || idx} style={s.row}>
              <View style={{ width: 130 }}>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: C.ink }}>
                  {cut(item.name, 22)}
                </Text>
                <Text style={{ fontSize: 7.5, color: C.muted }}>
                  {item.gender} {item.age ? `· ${item.age} anos` : ""}
                </Text>
              </View>

              <View style={{ width: 120 }}>
                <Text style={{ fontSize: 8.5, color: C.ink }}>{cut(item.role, 24)}</Text>
                <Text style={{ fontSize: 7.5, color: C.muted }}>{item.area}</Text>
              </View>

              <View style={{ width: 70 }}>
                <Text style={{ fontSize: 8.5, color: C.ink, fontFamily: "Helvetica-Bold" }}>{item.level}</Text>
                <Text style={{ fontSize: 7.5, color: C.muted }}>
                  {item.tenureFormatted !== "Não informado" ? item.tenureFormatted : "Sem data"}
                </Text>
              </View>

              <View style={{ width: 85 }}>
                <Text style={{ fontSize: 8, color: C.text }}>{cut(item.location, 18)}</Text>
                {item.topCompany && (
                  <Text style={{ fontSize: 7, color: C.muted }}>ex: {cut(item.topCompany, 15)}</Text>
                )}
              </View>

              <View style={{ width: 50, alignItems: "flex-end" }}>
                <View
                  style={{
                    backgroundColor: (item.score ?? 0) >= 80 ? "#e4f6ec" : "#f4f4f5",
                    paddingVertical: 2,
                    paddingHorizontal: 6,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: scoreColor }}>
                    {item.score !== null ? `${item.score}%` : "—"}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        <View style={{ marginTop: 18, padding: 10, backgroundColor: C.tint, borderRadius: 6, borderWidth: 0.5, borderColor: C.rule }}>
          <Text style={{ fontSize: 7.5, color: C.muted, lineHeight: 1.4 }}>
            * As avaliações de aderência refletem a correspondência semântica e critérios estabelecidos nas vagas abertas. A
            decisão de avanço, entrevista e contratação permanece integralmente com o gestor responsável (Regra 2 da Plataforma).
          </Text>
        </View>

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text>{footerText}</Text>
          <Text render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

