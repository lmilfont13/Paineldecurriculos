import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ThemeConfig {
  background: string;
  cardBg: string;
  border: string;
  accent: string;
  titleColor: string;
  subColor: string;
  textColor: string;
  badgeBg: string;
  badgeText: string;
  tagline: string;
  footerColor: string;
  isLight?: boolean;
}

const THEMES: Record<string, ThemeConfig> = {
  navy: {
    background: "linear-gradient(145deg, #060b17 0%, #0c1a38 50%, #060b17 100%)",
    cardBg: "rgba(12, 26, 56, 0.65)",
    border: "rgba(245, 158, 11, 0.35)",
    accent: "#fbbf24",
    titleColor: "#ffffff",
    subColor: "#fef3c7",
    textColor: "#e2e8f0",
    badgeBg: "rgba(245, 158, 11, 0.15)",
    badgeText: "#fef3c7",
    tagline: "HOMENAGEM CORPORATIVA",
    footerColor: "#94a3b8",
  },
  graphite: {
    background: "linear-gradient(145deg, #09090b 0%, #18181b 50%, #09090b 100%)",
    cardBg: "rgba(255, 255, 255, 0.04)",
    border: "rgba(255, 255, 255, 0.15)",
    accent: "#e4e4e7",
    titleColor: "#ffffff",
    subColor: "#a1a1aa",
    textColor: "#e4e4e7",
    badgeBg: "rgba(255, 255, 255, 0.08)",
    badgeText: "#f4f4f5",
    tagline: "RECONHECIMENTO & SUCESSO",
    footerColor: "#71717a",
  },
  emerald: {
    background: "linear-gradient(145deg, #021a14 0%, #064e3b 50%, #021a14 100%)",
    cardBg: "rgba(6, 78, 59, 0.45)",
    border: "rgba(52, 211, 153, 0.35)",
    accent: "#34d399",
    titleColor: "#ffffff",
    subColor: "#a7f3d0",
    textColor: "#ecfdf5",
    badgeBg: "rgba(52, 211, 153, 0.15)",
    badgeText: "#d1fae5",
    tagline: "CELEBRAÇÃO INSTITUCIONAL",
    footerColor: "#6ee7b7",
  },
  clean: {
    background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)",
    cardBg: "#ffffff",
    border: "rgba(15, 23, 42, 0.12)",
    accent: "#0f172a",
    titleColor: "#0f172a",
    subColor: "#b45309",
    textColor: "#334155",
    badgeBg: "rgba(15, 23, 42, 0.05)",
    badgeText: "#0f172a",
    tagline: "HOMENAGEM PROFISSIONAL",
    footerColor: "#64748b",
    isLight: true,
  },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const rawName = searchParams.get("name") || "Colaborador";
  const displayMode = searchParams.get("displayMode") || "full"; // full | first
  const company = searchParams.get("company") || "Nossa Empresa";
  const themeKey = searchParams.get("theme") || "navy";
  const customMessage = searchParams.get("message");
  const age = searchParams.get("age") || "";
  const showAgeParam = searchParams.get("showAge");

  const nameParts = rawName.trim().split(/\s+/);
  const displayName =
    displayMode === "first"
      ? nameParts[0]
      : nameParts.length > 3
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
      : rawName.trim();

  const turningAgeNumber = parseInt(age, 10);
  const hasValidAge = !isNaN(turningAgeNumber) && turningAgeNumber > 0;
  const showAge = showAgeParam === "true" && hasValidAge;

  const currentTheme = THEMES[themeKey] || THEMES.navy;

  const defaultGreeting = showAge
    ? `Neste dia especial em que você completa ${turningAgeNumber} anos, celebramos sua trajetória e agradecemos por fazer parte de nossa história. Desejamos contínuo sucesso, saúde, realizações e prosperidade em cada etapa de sua jornada.`
    : "Neste dia especial, celebramos a sua trajetória e expressamos nossa admiração por sua dedicação. Desejamos contínuo sucesso, saúde, realizações e prosperidade em cada etapa de sua vida pessoal e profissional.";

  const bodyText = customMessage?.trim() || defaultGreeting;

  // Dimensões do Card: 1080x1080 (Padrão de alta resolução para WhatsApp e feeds corporativos)
  const width = 1080;
  const height = 1080;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          background: currentTheme.background,
          padding: "72px 80px",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          position: "relative",
        }}
      >
        {/* Moldura de Borda Fina de Prestígio */}
        <div
          style={{
            position: "absolute",
            top: "32px",
            bottom: "32px",
            left: "32px",
            right: "32px",
            border: `1px solid ${currentTheme.border}`,
            borderRadius: "28px",
            pointerEvents: "none",
          }}
        />

        {/* 1. Cabeçalho Corporativo Institucional */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            zIndex: 2,
            borderBottom: `1px solid ${currentTheme.border}`,
            paddingBottom: "28px",
          }}
        >
          {/* Badge Tagline Institucional */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: currentTheme.badgeBg,
              padding: "10px 22px",
              borderRadius: "100px",
              border: `1px solid ${currentTheme.border}`,
            }}
          >
            <span
              style={{
                fontSize: "14px",
                fontWeight: 800,
                color: currentTheme.badgeText,
                letterSpacing: "3px",
                textTransform: "uppercase",
              }}
            >
              ✦ {currentTheme.tagline}
            </span>
          </div>

          {/* Nome da Empresa */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <span
              style={{
                fontSize: "22px",
                fontWeight: 900,
                color: currentTheme.titleColor,
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              {company}
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: currentTheme.footerColor,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                marginTop: "2px",
              }}
            >
              Gestão de Pessoas & Talentos
            </span>
          </div>
        </div>

        {/* 2. Centro: Cartão de Homenagem Refinado */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            width: "100%",
            background: currentTheme.cardBg,
            border: `1px solid ${currentTheme.border}`,
            borderRadius: "32px",
            padding: "54px 50px",
            boxShadow: currentTheme.isLight
              ? "0 20px 40px rgba(15, 23, 42, 0.06)"
              : "0 25px 50px rgba(0, 0, 0, 0.5)",
            zIndex: 2,
          }}
        >
          {/* Subtítulo Elegante */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "14px",
            }}
          >
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: currentTheme.accent,
                letterSpacing: "4px",
                textTransform: "uppercase",
              }}
            >
              FELIZ ANIVERSÁRIO
            </span>
          </div>

          {/* Nome da Pessoa */}
          <div
            style={{
              fontSize: displayName.length > 24 ? "52px" : "64px",
              fontWeight: 900,
              color: currentTheme.titleColor,
              marginBottom: "18px",
              letterSpacing: "-1.5px",
              lineHeight: 1.12,
            }}
          >
            {displayName}
          </div>

          {/* Linha Divisória de Prestígio */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              width: "280px",
              margin: "8px 0 24px 0",
            }}
          >
            <div
              style={{
                flex: 1,
                height: "1px",
                background: currentTheme.border,
              }}
            />
            <span
              style={{
                color: currentTheme.accent,
                fontSize: "14px",
              }}
            >
              ◆
            </span>
            <div
              style={{
                flex: 1,
                height: "1px",
                background: currentTheme.border,
              }}
            />
          </div>

          {/* Tag de Marco Comemorativo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "28px",
            }}
          >
            <span
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: currentTheme.subColor,
                letterSpacing: "1px",
              }}
            >
              {showAge
                ? `Celebrando ${turningAgeNumber} anos de realizações e novas conquistas`
                : "Celebrando sua dedicação, talento e novas conquistas"}
            </span>
          </div>

          {/* Mensagem Institucional Formal */}
          <div
            style={{
              fontSize: bodyText.length > 200 ? "21px" : "24px",
              lineHeight: 1.6,
              color: currentTheme.textColor,
              maxWidth: "840px",
              textAlign: "center",
              fontWeight: 400,
            }}
          >
            &ldquo;{bodyText}&rdquo;
          </div>
        </div>

        {/* 3. Rodapé Corporativo com Assinatura */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            zIndex: 2,
            borderTop: `1px solid ${currentTheme.border}`,
            paddingTop: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: currentTheme.footerColor,
                letterSpacing: "0.5px",
              }}
            >
              Com o reconhecimento e os sinceros votos de toda a equipe
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                fontSize: "16px",
                fontWeight: 800,
                color: currentTheme.titleColor,
                letterSpacing: "1px",
              }}
            >
              {company}
            </span>
            <span
              style={{
                fontSize: "14px",
                color: currentTheme.footerColor,
              }}
            >
              • {new Date().getFullYear()}
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
    }
  );
}
