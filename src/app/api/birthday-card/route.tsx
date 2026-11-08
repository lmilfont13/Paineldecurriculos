import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const name = searchParams.get("name") || "Colaborador";
  const age = searchParams.get("age") || "";
  const company = searchParams.get("company") || "Nossa Equipe";
  const theme = searchParams.get("theme") || "gold"; // gold | party | elegant
  const customMessage = searchParams.get("message");

  const firstName = name.split(" ")[0];
  const turningAgeNumber = parseInt(age, 10);
  const hasValidAge = !isNaN(turningAgeNumber) && turningAgeNumber > 0;

  // Dimensões do Cartão: 1080x1080 (Formato padrão ideal para WhatsApp e redes)
  const width = 1080;
  const height = 1080;

  // Configurações de Temas
  const themes = {
    gold: {
      background: "linear-gradient(145deg, #1c1917 0%, #0c0a09 50%, #1c1917 100%)",
      accent: "#f59e0b",
      accentGradient: "linear-gradient(90deg, #fbbf24, #f59e0b, #d97706)",
      cardBg: "rgba(255, 255, 255, 0.05)",
      borderColor: "rgba(245, 158, 11, 0.3)",
      badgeBg: "rgba(245, 158, 11, 0.15)",
      badgeText: "#fbbf24",
      tagline: "CELEBRANDO SEU DIA ESPECIAL",
    },
    party: {
      background: "linear-gradient(145deg, #0f172a 0%, #1e1b4b 50%, #31104b 100%)",
      accent: "#ec4899",
      accentGradient: "linear-gradient(90deg, #ec4899, #8b5cf6, #3b82f6)",
      cardBg: "rgba(255, 255, 255, 0.07)",
      borderColor: "rgba(236, 72, 153, 0.35)",
      badgeBg: "rgba(236, 72, 153, 0.2)",
      badgeText: "#f472b6",
      tagline: "MUITAS FELICIDADES E SUCESSO",
    },
    elegant: {
      background: "linear-gradient(145deg, #09090b 0%, #18181b 50%, #09090b 100%)",
      accent: "#10b981",
      accentGradient: "linear-gradient(90deg, #34d399, #10b981, #059669)",
      cardBg: "rgba(255, 255, 255, 0.04)",
      borderColor: "rgba(16, 185, 129, 0.3)",
      badgeBg: "rgba(16, 185, 129, 0.15)",
      badgeText: "#34d399",
      tagline: "PARABÉNS DA NOSSA EQUIPE",
    },
  };

  const currentTheme = themes[theme as keyof typeof themes] || themes.gold;

  const defaultGreeting = hasValidAge
    ? `Desejamos um novo ciclo repleto de saúde, conquistas, alegria e grandes realizações! Parabéns pelos seus ${turningAgeNumber} anos!`
    : "Desejamos um novo ciclo repleto de saúde, alegria, grandes conquistas e sucesso profissional!";

  const bodyText = customMessage?.trim() || defaultGreeting;

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
          padding: "64px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Moldura Decorativa Superior */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            borderBottom: `1px solid ${currentTheme.borderColor}`,
            paddingBottom: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "36px" }}>🎂</span>
            <span
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: currentTheme.badgeText,
                letterSpacing: "3px",
                textTransform: "uppercase",
              }}
            >
              {currentTheme.tagline}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: currentTheme.badgeBg,
              padding: "10px 22px",
              borderRadius: "999px",
              border: `1px solid ${currentTheme.borderColor}`,
            }}
          >
            <span style={{ fontSize: "20px" }}>🎉</span>
            <span style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>
              {company}
            </span>
          </div>
        </div>

        {/* Centro: Cartão Principal de Celebração */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            width: "100%",
            background: currentTheme.cardBg,
            border: `2px solid ${currentTheme.borderColor}`,
            borderRadius: "40px",
            padding: "56px 48px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Badge de Destaque Festivo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: currentTheme.badgeBg,
              padding: "10px 24px",
              borderRadius: "999px",
              marginBottom: "28px",
              border: `1px solid ${currentTheme.borderColor}`,
            }}
          >
            <span style={{ fontSize: "24px" }}>✨</span>
            <span
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: currentTheme.badgeText,
                letterSpacing: "1.5px",
              }}
            >
              {hasValidAge ? `COMPLETANDO ${turningAgeNumber} ANOS HOJE` : "FELIZ ANIVERSÁRIO"}
            </span>
            <span style={{ fontSize: "24px" }}>✨</span>
          </div>

          {/* Nome do Aniversariante */}
          <div
            style={{
              fontSize: name.length > 25 ? "52px" : "66px",
              fontWeight: 900,
              color: "#ffffff",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              letterSpacing: "-1px",
              lineHeight: 1.1,
            }}
          >
            Parabéns, {firstName}!
          </div>

          {/* Idade em destaque estilizado se houver */}
          {hasValidAge && (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "8px",
                marginBottom: "24px",
              }}
            >
              <span
                style={{
                  fontSize: "44px",
                  fontWeight: 900,
                  color: currentTheme.accent,
                }}
              >
                {turningAgeNumber}
              </span>
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#d4d4d8",
                  letterSpacing: "0.5px",
                }}
              >
                anos de história e sucesso!
              </span>
            </div>
          )}

          {/* Mensagem Calorosa de Felicitação */}
          <div
            style={{
              fontSize: "24px",
              lineHeight: 1.55,
              color: "#e4e4e7",
              maxWidth: "820px",
              display: "flex",
              textAlign: "center",
              marginTop: "8px",
            }}
          >
            "{bodyText}"
          </div>

          {/* Decoração de Ícones Comemorativos */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "20px",
              marginTop: "36px",
              fontSize: "32px",
            }}
          >
            <span>🎈</span>
            <span>🥂</span>
            <span>🎂</span>
            <span>🎊</span>
            <span>⭐</span>
          </div>
        </div>

        {/* Rodapé Elegante com Marca da Empresa */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            borderTop: `1px solid ${currentTheme.borderColor}`,
            paddingTop: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>⭐</span>
            <span style={{ fontSize: "16px", fontWeight: 600, color: "#a1a1aa" }}>
              Com carinho de toda a equipe de Atração & Talentos
            </span>
          </div>

          <div
            style={{
              fontSize: "20px",
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "1px",
            }}
          >
            {company}
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
