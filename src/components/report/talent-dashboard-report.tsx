// Relatório Executivo em PDF: Dashboard Completo de Talentos & Capital Humano (nível Michelin).
// Formato compacto, denso e sofisticado em 2 páginas executivas (sem capa desperdiçada).
import { Document, G, Line, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

import { C, SvgText, cut, num } from "@/components/report/report-kit";
import type { TalentDashboardData } from "@/server/models/talent-dashboard.model";

const ds = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: C.text,
  },
  headerStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    marginBottom: 12,
  },
  companyEyebrow: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  mainTitle: {
    fontFamily: "Times-Bold",
    fontSize: 18,
    color: "#0f172a",
    letterSpacing: -0.2,
  },
  subTitle: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 2,
  },
  metaRight: {
    alignItems: "flex-end",
    gap: 3,
  },
  dateBadge: {
    fontSize: 7.5,
    color: "#64748b",
  },
  countBadge: {
    backgroundColor: "#0f172a",
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  countBadgeText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 8,
    backgroundColor: "#f8fafc",
  },
  kpiValue: {
    fontFamily: "Times-Bold",
    fontSize: 16,
    color: "#0f172a",
  },
  kpiLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 6.8,
    color: "#64748b",
    marginTop: 1.5,
  },
  sectionTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  cardBox: {
    borderWidth: 0.75,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 10,
    backgroundColor: "#ffffff",
  },
  cardBoxTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    color: "#0f172a",
    marginBottom: 6,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#94a3b8",
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
  th: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4.5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
  },
});

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

/** Gráfico Donut compacto para visualização de gênero. */
function MiniDonut({
  data,
  size = 72,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const cx = size / 2;
  const r = size / 2 - 2;
  let angle = -Math.PI / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {total === 0 ? (
        <Rect x={0} y={0} width={size} height={size} rx={size / 2} fill="#e2e8f0" />
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
      <SvgText x={cx} y={cx + 1} textAnchor="middle" fontSize={12} fill="#0f172a">
        {String(total)}
      </SvgText>
      <SvgText x={cx} y={cx + 8} textAnchor="middle" fontSize={5} fill="#64748b">
        total
      </SvgText>
    </Svg>
  );
}

/** Barras horizontais compactas e refinadas. */
function DenseBars({
  rows,
  total,
  color,
  width = 240,
  labelW = 95,
  rowH = 15,
}: {
  rows: { label: string; value: number }[];
  total: number;
  color: string;
  width?: number;
  labelW?: number;
  rowH?: number;
}) {
  const valueW = 48;
  const plotW = width - labelW - valueW;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const H = rows.length * rowH;

  return (
    <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
      {rows.map((r, i) => {
        const y = i * rowH;
        const w = (r.value / max) * plotW;
        const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
        return (
          <G key={r.label}>
            <SvgText x={0} y={y + 10} fontSize={7} fill="#334155">
              {cut(r.label, Math.floor(labelW / 4.4))}
            </SvgText>
            <Rect
              x={labelW}
              y={y + 3}
              width={r.value > 0 ? Math.max(w, 2) : 0}
              height={7.5}
              rx={1.5}
              fill={color}
            />
            <SvgText x={labelW + w + 4} y={y + 9.5} fontSize={6.8} fill="#64748b">
              {`${r.value} (${pct}%)`}
            </SvgText>
          </G>
        );
      })}
    </Svg>
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

  const ageRows = data.age.brackets
    .filter((b) => b.count > 0 || b.label !== "Não informada")
    .map((b) => ({ label: b.label, value: b.count }));

  const roleRows = data.roles.slice(0, 6).map((r) => ({ label: r.label, value: r.count }));
  const companyRows = data.companies.topCompanies.slice(0, 6).map((c) => ({ label: c.label, value: c.count }));
  const levelRows = data.levels.slice(0, 5).map((l) => ({ label: l.label, value: l.count }));
  const areaRows = data.areas.slice(0, 5).map((a) => ({ label: a.label, value: a.count }));

  return (
    <Document
      title={`Dashboard Executivo de Talentos - ${company}`}
      author={company}
      subject="Panorama Demográfico e Inteligência de Mercado"
    >
      {/* ═══════════════════════════════════════════════════════════════
          PÁGINA 1: DASHBOARD ANALÍTICO (DEMOGRAFIA, MERCADO & CARGOS)
          ═══════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={ds.page}>
        {/* Cabeçalho Executivo Compacto */}
        <View style={ds.headerStrip}>
          <View>
            <Text style={[ds.companyEyebrow, { color: brand }]}>{company} · TALENT INTELLIGENCE</Text>
            <Text style={ds.mainTitle}>Dashboard Executivo de Talentos & CVs</Text>
            <Text style={ds.subTitle}>
              Panorama demográfico, mercado de trabalho, cargos e histórico de permanência
            </Text>
          </View>
          <View style={ds.metaRight}>
            <View style={[ds.countBadge, { backgroundColor: brand }]}>
              <Text style={ds.countBadgeText}>{data.totals.candidates} TALENTOS</Text>
            </View>
            <Text style={ds.dateBadge}>{dateFormatted}</Text>
          </View>
        </View>

        {/* Linha de 4 KPIs Executivos */}
        <View style={ds.kpiRow}>
          <View style={ds.kpiCard}>
            <Text style={ds.kpiValue}>{data.totals.candidates}</Text>
            <Text style={ds.kpiLabel}>Base Mapeada</Text>
            <Text style={ds.kpiSub}>
              {data.totals.withPdf} com PDF · {data.totals.withPhoto} fotos
            </Text>
          </View>
          <View style={ds.kpiCard}>
            <Text style={[ds.kpiValue, { color: "#be185d" }]}>
              {data.gender.female.pct}% <Text style={{ fontSize: 11, color: "#1d4ed8" }}>/ {data.gender.male.pct}%</Text>
            </Text>
            <Text style={ds.kpiLabel}>Divisão Mulheres / Homens</Text>
            <Text style={ds.kpiSub}>
              {data.gender.female.count} F · {data.gender.male.count} M
            </Text>
          </View>
          <View style={ds.kpiCard}>
            <Text style={ds.kpiValue}>
              {data.age.mean ? `${data.age.mean} anos` : "—"}
            </Text>
            <Text style={ds.kpiLabel}>Idade Média</Text>
            <Text style={ds.kpiSub}>
              Mediana: {data.age.median ?? "—"}a · {data.age.min ?? "—"} a {data.age.max ?? "—"}a
            </Text>
          </View>
          <View style={ds.kpiCard}>
            <Text style={[ds.kpiValue, { color: "#15803d" }]}>
              {data.totals.topMatchesCount} <Text style={{ fontSize: 10, color: "#64748b" }}>({data.totals.topMatchesPct}%)</Text>
            </Text>
            <Text style={ds.kpiLabel}>Top Match (80%+)</Text>
            <Text style={ds.kpiSub}>
              Score Médio {data.totals.avgScore ?? "—"}/100
            </Text>
          </View>
        </View>

        {/* BLOCO 1: DEMOGRAFIA (GÊNERO & IDADE) */}
        <View style={{ marginBottom: 12 }}>
          <Text style={ds.sectionTitle}>1. Panorama Demográfico & Diversidade</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {/* Box Gênero */}
            <View style={[ds.cardBox, { width: 220 }]}>
              <Text style={ds.cardBoxTitle}>Distribuição por Gênero</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <MiniDonut data={genderDonutData} size={72} />
                <View style={{ gap: 5, flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 1.5, backgroundColor: "#be185d" }} />
                      <Text style={{ fontSize: 7.5, color: "#0f172a" }}>Feminino</Text>
                    </View>
                    <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#0f172a" }}>
                      {data.gender.female.count} ({data.gender.female.pct}%)
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 1.5, backgroundColor: "#1d4ed8" }} />
                      <Text style={{ fontSize: 7.5, color: "#0f172a" }}>Masculino</Text>
                    </View>
                    <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#0f172a" }}>
                      {data.gender.male.count} ({data.gender.male.pct}%)
                    </Text>
                  </View>

                  {data.gender.unspecified.count > 0 && (
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 1.5, backgroundColor: "#94a3b8" }} />
                        <Text style={{ fontSize: 7.5, color: "#64748b" }}>Outros</Text>
                      </View>
                      <Text style={{ fontSize: 7.5, color: "#64748b" }}>
                        {data.gender.unspecified.count} ({data.gender.unspecified.pct}%)
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Box Faixas Etárias */}
            <View style={[ds.cardBox, { flex: 1 }]}>
              <Text style={ds.cardBoxTitle}>Faixas Etárias Identificadas</Text>
              <DenseBars rows={ageRows} total={data.totals.candidates} color="#6366f1" width={265} labelW={75} rowH={14} />
            </View>
          </View>
        </View>

        {/* BLOCO 2: MERCADO & EXPERIÊNCIAS */}
        <View style={{ marginBottom: 12 }}>
          <Text style={ds.sectionTitle}>2. Inteligência de Mercado & Histórico de Empresas</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {/* Cargos Mais Vistos */}
            <View style={[ds.cardBox, { flex: 1 }]}>
              <Text style={ds.cardBoxTitle}>Cargos Mais Frequentes</Text>
              <DenseBars
                rows={roleRows}
                total={data.totals.candidates}
                color={brand}
                width={245}
                labelW={105}
                rowH={14.5}
              />
            </View>

            {/* Empresas Mais Frequentes */}
            <View style={[ds.cardBox, { flex: 1 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <Text style={ds.cardBoxTitle}>Empresas com Mais Passagens</Text>
                <Text style={{ fontSize: 6.8, color: "#15803d", fontFamily: "Helvetica-Bold" }}>
                  Média: {data.companies.avgTenureFormatted}
                </Text>
              </View>
              <DenseBars
                rows={companyRows.length > 0 ? companyRows : [{ label: "Sem registros explícitos", value: 0 }]}
                total={data.totals.candidates}
                color="#0d9488"
                width={245}
                labelW={105}
                rowH={14.5}
              />
            </View>
          </View>
        </View>

        {/* BLOCO 3: SENIORIDADE & ÁREAS */}
        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {/* Senioridade */}
            <View style={[ds.cardBox, { flex: 1 }]}>
              <Text style={ds.cardBoxTitle}>Níveis de Senioridade</Text>
              <DenseBars rows={levelRows} total={data.totals.candidates} color="#d97706" width={245} labelW={80} rowH={13} />
            </View>

            {/* Áreas */}
            <View style={[ds.cardBox, { flex: 1 }]}>
              <Text style={ds.cardBoxTitle}>Áreas Profissionais</Text>
              <DenseBars rows={areaRows} total={data.totals.candidates} color="#2563eb" width={245} labelW={80} rowH={13} />
            </View>
          </View>
        </View>

        {/* Rodapé Página 1 */}
        <View style={ds.footer} fixed>
          <Text>{footerText}</Text>
          <Text render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════
          PÁGINA 2: DOSSIÊ DOS PRINCIPAIS TALENTOS (TOP MATCHES)
          ═══════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={ds.page}>
        {/* Cabeçalho da Página 2 */}
        <View style={ds.headerStrip}>
          <View>
            <Text style={[ds.companyEyebrow, { color: brand }]}>RADAR DE EXCELÊNCIA · TOP CANDIDATOS</Text>
            <Text style={ds.mainTitle}>Ranking dos Principais Talentos da Base</Text>
            <Text style={ds.subTitle}>
              Candidatos com maior nota de aderência pela IA e histórico comprovado de mercado
            </Text>
          </View>
          <View style={ds.metaRight}>
            <View style={[ds.countBadge, { backgroundColor: "#15803d" }]}>
              <Text style={ds.countBadgeText}>{data.totals.topMatchesCount} TOP MATCHES</Text>
            </View>
            <Text style={ds.dateBadge}>{company}</Text>
          </View>
        </View>

        {/* Tabela de Top Candidatos */}
        <View style={ds.cardBox}>
          {/* Cabeçalho da Tabela */}
          <View style={[ds.tableRow, { borderBottomWidth: 1.2, borderBottomColor: "#0f172a", paddingBottom: 5 }]}>
            <Text style={[ds.th, { width: 22 }]}>#</Text>
            <Text style={[ds.th, { width: 145 }]}>Candidato</Text>
            <Text style={[ds.th, { width: 125 }]}>Cargo / Perfil</Text>
            <Text style={[ds.th, { width: 68 }]}>Nível / Idade</Text>
            <Text style={[ds.th, { width: 85 }]}>Localização</Text>
            <Text style={[ds.th, { width: 45, textAlign: "right" }]}>Score IA</Text>
          </View>

          {/* Linhas da Tabela (até 14 talentos nobres) */}
          {data.highlights.slice(0, 14).map((item, idx) => {
            const isTop = (item.score ?? 0) >= 80;
            const scoreColor = isTop ? "#15803d" : (item.score ?? 0) >= 60 ? "#d97706" : "#64748b";
            const scoreBg = isTop ? "#ecfdf5" : (item.score ?? 0) >= 60 ? "#fffbeb" : "#f1f5f9";

            return (
              <View key={item.id || idx} style={ds.tableRow}>
                <Text style={{ width: 22, fontFamily: "Times-Bold", fontSize: 10, color: isTop ? brand : "#94a3b8" }}>
                  {idx + 1}
                </Text>

                <View style={{ width: 145, paddingRight: 6 }}>
                  <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#0f172a" }}>
                    {cut(item.name, 26)}
                  </Text>
                  <Text style={{ fontSize: 6.8, color: "#64748b" }}>
                    {item.gender} {item.age ? `· ${item.age} anos` : ""} {item.topCompany ? `· ex: ${cut(item.topCompany, 14)}` : ""}
                  </Text>
                </View>

                <View style={{ width: 125, paddingRight: 4 }}>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1e293b" }}>
                    {cut(item.role, 24)}
                  </Text>
                  <Text style={{ fontSize: 6.8, color: "#64748b" }}>
                    {item.area} {item.skills.length > 0 ? `(${item.skills[0]})` : ""}
                  </Text>
                </View>

                <View style={{ width: 68 }}>
                  <Text style={{ fontSize: 7.8, fontFamily: "Helvetica-Bold", color: "#334155" }}>
                    {item.level}
                  </Text>
                  <Text style={{ fontSize: 6.8, color: "#64748b" }}>
                    {item.tenureFormatted !== "Não informado" ? item.tenureFormatted : "Sem data"}
                  </Text>
                </View>

                <View style={{ width: 85 }}>
                  <Text style={{ fontSize: 7.5, color: "#334155" }}>
                    {cut(item.location, 20)}
                  </Text>
                </View>

                <View style={{ width: 45, alignItems: "flex-end" }}>
                  <View style={{ backgroundColor: scoreBg, paddingVertical: 1.5, paddingHorizontal: 5, borderRadius: 3 }}>
                    <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: scoreColor }}>
                      {item.score !== null ? `${item.score}%` : "—"}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Nota Metodológica Executiva */}
        <View style={{ marginTop: 12, padding: 8, backgroundColor: "#f8fafc", borderRadius: 5, borderWidth: 0.5, borderColor: "#e2e8f0" }}>
          <Text style={{ fontSize: 6.8, color: "#64748b", lineHeight: 1.4 }}>
            * Metodologia: Scores e perfis apurados por correspondência semântica nos currículos pelo motor de Inteligência Artificial.
            Conforme as diretrizes da plataforma, a IA opera estritamente como apoio consultivo; o avanço de etapas e a contratação
            permanecem sob decisão soberana e manual do gestor.
          </Text>
        </View>

        {/* Rodapé Página 2 */}
        <View style={ds.footer} fixed>
          <Text>{footerText}</Text>
          <Text render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
