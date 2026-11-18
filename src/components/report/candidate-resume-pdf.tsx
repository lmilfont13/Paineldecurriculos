import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { C, STAGE_LABEL } from "@/components/report/report-kit";

export type CandidateResumePdfData = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  desiredRole: string | null;
  instagram: string | null;
  salaryExpectation: string | null;
  workPreference: string | null;
  availability: string | null;
  hasCnh: string | null;
  maritalStatus: string | null;
  professionalSummary: string | null;
  status: string;
  aiScore: number | null;
  aiReasoning: string | null;
  aiProfile: string | null;
  aiArea: string | null;
  aiLevel: string | null;
  aiHighlights: string[];
  aiCareerSummary: string | null;
  resumeText: string | null;
  jobTitle: string;
  companyName: string;
  brandColor?: string;
  createdAt: Date;
  answers: { label: string; value: string }[];
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: C.text,
    lineHeight: 1.45,
  },
  headerBox: {
    borderBottomWidth: 1.5,
    borderBottomColor: C.ink,
    paddingBottom: 14,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 7.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    marginBottom: 4,
  },
  name: {
    fontFamily: "Times-Bold",
    fontSize: 22,
    color: C.ink,
    lineHeight: 1.15,
  },
  roleSubtitle: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: "#57534e",
    marginTop: 4,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
    fontSize: 8.5,
    color: C.text,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  badge: {
    backgroundColor: C.tint,
    borderWidth: 0.75,
    borderColor: C.rule,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: C.ink,
    borderBottomWidth: 0.75,
    borderBottomColor: C.rule,
    paddingBottom: 4,
    marginBottom: 8,
  },
  card: {
    backgroundColor: C.tint,
    borderWidth: 0.75,
    borderColor: C.rule,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  grid2: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gridItem: {
    width: "48%",
    marginBottom: 6,
  },
  label: {
    fontSize: 7.5,
    color: C.muted,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  value: {
    fontSize: 9,
    color: C.ink,
    marginTop: 1,
  },
  paragraph: {
    fontSize: 9,
    color: C.text,
    lineHeight: 1.5,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  bulletDot: {
    width: 10,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.good,
  },
  bulletText: {
    flex: 1,
    fontSize: 8.8,
    color: C.text,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: C.muted,
    borderTopWidth: 0.75,
    borderTopColor: C.rule,
    paddingTop: 8,
  },
});

export function CandidateResumePdf({ data }: { data: CandidateResumePdfData }) {
  const brand = data.brandColor || "#7a1f3d";
  const locationParts = [data.neighborhood, data.city, data.state].filter(Boolean);
  const locationText = locationParts.length > 0 ? locationParts.join(" · ") : null;

  const roleParts = [
    data.desiredRole || data.aiProfile,
    data.aiArea ? `Área: ${data.aiArea}` : null,
    data.aiLevel ? `Nível: ${data.aiLevel}` : null,
  ].filter(Boolean);

  const details: { label: string; value: string }[] = [];
  if (data.salaryExpectation) details.push({ label: "Pretensão salarial", value: data.salaryExpectation });
  if (data.availability) details.push({ label: "Disponibilidade", value: data.availability });
  if (data.workPreference) details.push({ label: "Modalidade preferida", value: data.workPreference });
  if (data.hasCnh) details.push({ label: "CNH", value: data.hasCnh });
  if (data.maritalStatus) details.push({ label: "Estado civil", value: data.maritalStatus });
  if (data.instagram) details.push({ label: "Instagram", value: `@${data.instagram.replace(/^@/, "")}` });

  const formattedDate = data.createdAt.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <Document
      title={`Currículo - ${data.name}`}
      author={data.companyName}
      subject={`Candidatura para ${data.jobTitle}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho do Currículo */}
        <View style={styles.headerBox}>
          <Text style={[styles.eyebrow, { color: brand }]}>
            CURRÍCULO & DOSSIÊ DO CANDIDATO · {data.companyName.toUpperCase()}
          </Text>
          <Text style={styles.name}>{data.name}</Text>
          {roleParts.length > 0 && (
            <Text style={styles.roleSubtitle}>{roleParts.join("  •  ")}</Text>
          )}

          <View style={styles.contactRow}>
            {data.email && <Text>E-mail: {data.email}</Text>}
            {data.phone && <Text>Tel/WhatsApp: {data.phone}</Text>}
            {locationText && <Text>Localização: {locationText}</Text>}
          </View>

          <View style={styles.badgeRow}>
            <Text style={styles.badge}>Vaga: {data.jobTitle}</Text>
            <Text style={styles.badge}>
              Etapa: {STAGE_LABEL[data.status] ?? data.status}
            </Text>
            {data.aiScore !== null && (
              <Text style={[styles.badge, { color: brand }]}>
                Score IA: {data.aiScore}/100
              </Text>
            )}
            <Text style={styles.badge}>Inscrito em {formattedDate}</Text>
          </View>
        </View>

        {/* Resumo Profissional / Carreira */}
        {(data.professionalSummary || data.aiCareerSummary || data.aiReasoning) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumo Profissional & Síntese</Text>
            {data.professionalSummary && (
              <View style={styles.card}>
                <Text style={styles.label}>Apresentação do Candidato</Text>
                <Text style={[styles.paragraph, { marginTop: 3 }]}>
                  {data.professionalSummary}
                </Text>
              </View>
            )}
            {data.aiCareerSummary && (
              <View style={styles.card}>
                <Text style={styles.label}>Trajetória Profissional Identificada</Text>
                <Text style={[styles.paragraph, { marginTop: 3 }]}>
                  {data.aiCareerSummary}
                </Text>
              </View>
            )}
            {data.aiReasoning && (
              <View style={styles.card}>
                <Text style={styles.label}>Parecer de Triagem (IA)</Text>
                <Text style={[styles.paragraph, { marginTop: 3 }]}>
                  {data.aiReasoning}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Destaques do Perfil */}
        {data.aiHighlights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pontos de Destaque</Text>
            {data.aiHighlights.map((hl, idx) => (
              <View key={idx} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{hl}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Informações Complementares */}
        {details.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dados Complementares</Text>
            <View style={styles.grid2}>
              {details.map((item, idx) => (
                <View key={idx} style={styles.gridItem}>
                  <Text style={styles.label}>{item.label}</Text>
                  <Text style={styles.value}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Respostas ao Formulário da Vaga */}
        {data.answers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Respostas da Candidatura</Text>
            {data.answers.map((ans, idx) => (
              <View key={idx} style={{ marginBottom: 6 }}>
                <Text style={styles.label}>{ans.label}</Text>
                <Text style={styles.value}>{ans.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Texto Integral Extraído do Currículo */}
        {data.resumeText && data.resumeText.trim().length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conteúdo Integral do Currículo</Text>
            <Text style={styles.paragraph}>{data.resumeText.trim()}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>
            Currículo · {data.name} · {data.companyName}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderCandidateResumePdfBuffer(
  data: CandidateResumePdfData
): Promise<Buffer> {
  return renderToBuffer(<CandidateResumePdf data={data} />);
}
