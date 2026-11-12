import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import {
  cardDisplayName,
  cardPalette,
  nameFontSize,
  type BirthdayCardParams,
} from "@/server/models/birthday-card.model";

const SIZE = 1080;
const FONT_DIR = join(process.cwd(), "src/assets/fonts");

// As fontes não dependem do pedido: lidas uma vez por instância.
const fonts = Promise.all([
  readFile(join(FONT_DIR, "fraunces-latin-600-normal.woff")),
  readFile(join(FONT_DIR, "fraunces-latin-400-italic.woff")),
  readFile(join(FONT_DIR, "inter-latin-400-normal.woff")),
  readFile(join(FONT_DIR, "inter-latin-600-normal.woff")),
]).then(([serif, serifItalic, sans, sansBold]) => [
  { name: "Fraunces", data: serif, weight: 600 as const, style: "normal" as const },
  { name: "Fraunces", data: serifItalic, weight: 400 as const, style: "italic" as const },
  { name: "Inter", data: sans, weight: 400 as const, style: "normal" as const },
  { name: "Inter", data: sansBold, weight: 600 as const, style: "normal" as const },
]);

/** Confete fixo (posição, tamanho, giro): o mesmo cartão sai sempre igual. */
const CONFETTI: { x: number; y: number; w: number; h: number; rot: number; tone: "A" | "B"; o: number }[] = [
  { x: 668, y: 92, w: 22, h: 22, rot: 0, tone: "A", o: 0.9 },
  { x: 742, y: 168, w: 34, h: 12, rot: 28, tone: "B", o: 0.55 },
  { x: 818, y: 74, w: 14, h: 14, rot: 0, tone: "B", o: 0.7 },
  { x: 886, y: 214, w: 40, h: 12, rot: -34, tone: "A", o: 0.85 },
  { x: 948, y: 122, w: 26, h: 26, rot: 0, tone: "A", o: 0.35 },
  { x: 612, y: 206, w: 12, h: 12, rot: 0, tone: "A", o: 0.5 },
  { x: 792, y: 288, w: 18, h: 18, rot: 0, tone: "B", o: 0.4 },
  { x: 968, y: 318, w: 30, h: 10, rot: 52, tone: "B", o: 0.6 },
  { x: 706, y: 342, w: 28, h: 10, rot: -18, tone: "A", o: 0.45 },
  { x: 902, y: 404, w: 12, h: 12, rot: 0, tone: "A", o: 0.7 },
  { x: 986, y: 482, w: 16, h: 16, rot: 0, tone: "B", o: 0.3 },
];

const LOGO_TYPES = ["image/png", "image/jpeg"];
const LOGO_MAX_BYTES = 600_000;

/** Baixa o logo da empresa para embutir no cartão; qualquer falha = cartão sem logo. */
async function loadLogo(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!res.ok || !LOGO_TYPES.includes(type)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > LOGO_MAX_BYTES) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export type BirthdayCardCompany = { name: string; primaryColor: string; logoUrl: string | null };

/** Cartão de aniversário 1080×1080 (PNG), com a marca da empresa. */
export async function renderBirthdayCard(
  params: BirthdayCardParams,
  company: BirthdayCardCompany
): Promise<ImageResponse> {
  const c = cardPalette(params.theme, company.primaryColor);
  const displayName = cardDisplayName(params.name, params.mode);
  const logo = await loadLogo(company.logoUrl);
  const companyName = company.name.trim().slice(0, 40) || "Nossa equipe";
  const messageSize = params.message.length > 170 ? 31 : params.message.length > 110 ? 34 : 38;

  return new ImageResponse(
    (
      <div
        style={{
          width: SIZE,
          height: SIZE,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          padding: 92,
          background: `linear-gradient(150deg, ${c.background} 0%, ${c.backgroundEnd} 100%)`,
          color: c.ink,
          fontFamily: "Inter",
        }}
      >
        {/* Luz e anel no canto: dão profundidade sem competir com o nome. */}
        <div
          style={{
            position: "absolute",
            top: -260,
            left: 560,
            width: 760,
            height: 760,
            borderRadius: 380,
            background: c.accent,
            opacity: 0.1,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -170,
            left: 650,
            width: 580,
            height: 580,
            borderRadius: 290,
            border: `2px solid ${c.accent}`,
            opacity: 0.35,
            display: "flex",
          }}
        />
        {CONFETTI.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
              borderRadius: p.w === p.h ? p.w / 2 : 5,
              background: p.tone === "A" ? c.confettiA : c.confettiB,
              opacity: p.o,
              transform: `rotate(${p.rot}deg)`,
              display: "flex",
            }}
          />
        ))}
        {params.age !== null && (
          <div
            style={{
              position: "absolute",
              right: 44,
              bottom: -70,
              display: "flex",
              fontFamily: "Fraunces",
              fontWeight: 600,
              fontSize: 400,
              lineHeight: 1,
              letterSpacing: -14,
              color: c.accent,
              opacity: 0.11,
            }}
          >
            {params.age}
          </div>
        )}

        {/* Empresa */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {logo && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 76,
                height: 76,
                borderRadius: 18,
                background: "#ffffff",
                marginRight: 22,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={logo} width={52} height={52} style={{ objectFit: "contain" }} />
            </div>
          )}
          <div style={{ display: "flex", fontSize: 27, fontWeight: 600, letterSpacing: 3.5, textTransform: "uppercase" }}>
            {companyName}
          </div>
        </div>

        {/* Mensagem */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 880 }}>
          <div style={{ display: "flex", fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 400, fontSize: 60, color: c.accent }}>
            Feliz aniversário,
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Fraunces",
              fontWeight: 600,
              fontSize: nameFontSize(displayName),
              lineHeight: 1.02,
              letterSpacing: -3,
              marginTop: 6,
            }}
          >
            {displayName}
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 40 }}>
            <div style={{ display: "flex", width: 96, height: 5, borderRadius: 3, background: c.accent }} />
            {params.age !== null && (
              <div style={{ display: "flex", marginLeft: 22, fontSize: 28, fontWeight: 600, letterSpacing: 2, color: c.accent }}>
                {`${params.age} ANOS`}
              </div>
            )}
          </div>
          <div style={{ display: "flex", marginTop: 38, fontSize: messageSize, lineHeight: 1.45, color: c.soft, maxWidth: 800 }}>
            {params.message}
          </div>
        </div>

        {/* Assinatura */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 26, color: c.soft }}>Com carinho,</div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 600, marginTop: 4 }}>{`Equipe ${companyName}`}</div>
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE, fonts: await fonts }
  );
}
