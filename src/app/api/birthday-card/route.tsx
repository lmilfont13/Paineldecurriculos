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
    background: "linear-gradient(to bottom right, #060b17, #0c1a38, #060b17)",
    cardBg: "rgba(12, 26, 56, 0.75)",
    border: "rgba(245, 158, 11, 0.4)",
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
    background: "linear-gradient(to bottom right, #09090b, #18181b, #09090b)",
    cardBg: "rgba(255, 255, 255, 0.05)",
    border: "rgba(255, 255, 255, 0.2)",
    accent: "#e4e4e7",
    titleColor: "#ffffff",
    subColor: "#a1a1aa",
    textColor: "#e4e4e7",
    badgeBg: "rgba(255, 255, 255, 0.1)",
    badgeText: "#f4f4f5",
    tagline: "RECONHECIMENTO & SUCESSO",
    footerColor: "#71717a",
  },
  emerald: {
    background: "linear-gradient(to bottom right, #021a14, #064e3b, #021a14)",
    cardBg: "rgba(6, 78, 59, 0.55)",
    border: "rgba(52, 211, 153, 0.4)",
    accent: "#34d399",
    titleColor: "#ffffff",
    subColor: "#a7f3d0",
    textColor: "#ecfdf5",
    badgeBg: "rgba(52, 211, 153, 0.18)",
    badgeText: "#d1fae5",
    tagline: "CELEBRACAO INSTITUCIONAL",
    footerColor: "#6ee7b7",
  },
  clean: {
    background: "linear-gradient(to bottom right, #ffffff, #f8fafc, #f1f5f9)",
    cardBg: "#ffffff",
    border: "rgba(15, 23, 42, 0.15)",
    accent: "#0f172a",
    titleColor: "#0f172a",
    subColor: "#b45309",
    textColor: "#334155",
    badgeBg: "rgba(15, 23, 42, 0.06)",
    badgeText: "#0f172a",
    tagline: "HOMENAGEM PROFISSIONAL",
    footerColor: "#64748b",
    isLight: true,
  },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const rawName = searchParams.get("name") || "Colaborador";
  const displayMode = searchParams.get("displayMode") || "full";
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
          position: "relative",
        }}
      >
        {/* Moldura de Borda Fina de Prestigio */}
        <div
          style={{
            position: "absolute",
            top: "32px",
            bottom: "32px",
            left: "32px",
            right: "32px",
            display: "flex",
            border: `1px solid ${currentTheme.border}`,
            borderRadius: "28px",
          }}
        />

        {/* 1. Cabecalho Corporativo Institucional */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            borderBottom: `1px solid ${currentTheme.border}`,
            paddingBottom: "28px",
          }}
        >
          {/* Badge Tagline Institucional */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
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
              }}
            >
              {currentTheme.tagline}
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
                marginTop: "2px",
              }}
            >
              GESTAO DE PESSOAS & TALENTOS
            </span>
          </div>
        </div>

        {/* 2. Centro: Cartao de Homenagem Refinado */}
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
          }}
        >
          {/* Subtitulo Elegante */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "14px",
            }}
          >
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: currentTheme.accent,
                letterSpacing: "4px",
              }}
            >
              FELIZ ANIVERSARIO
            </span>
          </div>

          {/* Nome da Pessoa */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
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

          {/* Linha Divisoria de Prestigio */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              width: "280px",
              margin: "8px 0 24px 0",
            }}
          >
            <div
              style={{
                display: "flex",
                flex: 1,
                height: "2px",
                background: currentTheme.border,
              }}
            />
            <div
              style={{
                display: "flex",
                width: "8px",
                height: "8px",
                borderRadius: "4px",
                background: currentTheme.accent,
                marginLeft: "12px",
                marginRight: "12px",
              }}
            />
            <div
              style={{
                display: "flex",
                flex: 1,
                height: "2px",
                background: currentTheme.border,
              }}
            />
          </div>

          {/* Tag de Marco Comemorativo */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
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
                ? `Celebrando ${turningAgeNumber} anos de realizacoes e conquistas`
                : "Celebrando sua dedicacao, talento e novas conquistas"}
            </span>
          </div>

          {/* Mensagem Institucional Formal */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontSize: bodyText.length > 200 ? "21px" : "24px",
              lineHeight: 1.6,
              color: currentTheme.textColor,
              maxWidth: "840px",
              textAlign: "center",
              fontWeight: 400,
            }}
          >
            <span>{`"${bodyText}"`}</span>
          </div>
        </div>

        {/* 3. Rodape Corporativo com Assinatura */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            borderTop: `1px solid ${currentTheme.border}`,
            paddingTop: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
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
              flexDirection: "row",
              alignItems: "center",
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
                marginLeft: "8px",
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
