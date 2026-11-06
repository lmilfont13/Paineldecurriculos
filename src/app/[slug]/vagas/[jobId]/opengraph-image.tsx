import { ImageResponse } from "next/og";
import { getJobDetailPageData } from "@/server/controllers/public.controller";
import { isDynamicOgEnabled } from "@/server/services/company-feature.service";
import { contractLabels, workModeLabels } from "@/server/models/job.model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Vaga em Destaque";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; jobId: string }>;
}) {
  const { slug, jobId } = await params;
  const data = await getJobDetailPageData(slug, jobId);

  if (!data) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            background: "#0a0a0a",
            color: "#fff",
            fontSize: "32px",
            fontFamily: "sans-serif",
          }}
        >
          Vaga não encontrada
        </div>
      ),
      { ...size }
    );
  }

  const { company, job } = data;
  const isEnabled = await isDynamicOgEnabled(company.id);

  const brandColor = isEnabled ? (company.primaryColor || "#0a0a0a") : "#0a0a0a";
  const location = job.location || "Brasil";
  const workMode = workModeLabels[job.workMode] || "Presencial";
  const contract = contractLabels[job.contract] || "CLT";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "60px 80px",
          background: "#fafaf9",
          borderTop: `16px solid ${brandColor}`,
          fontFamily: "sans-serif",
        }}
      >
        {/* Top Header: Company info & Badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoUrl}
                alt={company.name}
                style={{ width: "64px", height: "64px", objectFit: "contain", borderRadius: "12px", background: "#fff", padding: "4px", border: "1px solid #e4e4e7" }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "64px",
                  height: "64px",
                  borderRadius: "16px",
                  background: brandColor,
                  color: "#fff",
                  fontSize: "26px",
                  fontWeight: "bold",
                }}
              >
                {company.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "28px", fontWeight: "bold", color: "#0a0a0a" }}>
                {company.name}
              </span>
              <span style={{ fontSize: "18px", color: "#71717a" }}>
                Oportunidade de Trabalho
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "#dcfce7",
              color: "#15803d",
              padding: "10px 22px",
              borderRadius: "999px",
              fontSize: "18px",
              fontWeight: "bold",
            }}
          >
            ● Vaga Aberta
          </div>
        </div>

        {/* Center: Job Title */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", margin: "20px 0" }}>
          <span style={{ fontSize: "52px", fontWeight: "900", color: "#0a0a0a", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            {job.title}
          </span>
          {job.code && (
            <span style={{ fontSize: "20px", color: "#a1a1aa", fontWeight: "600" }}>
              Código #{job.code}
            </span>
          )}
        </div>

        {/* Bottom Tags and CTA */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", borderTop: "2px solid #e4e4e7", paddingTop: "32px" }}>
          <div style={{ display: "flex", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid #e4e4e7", padding: "10px 20px", borderRadius: "12px", fontSize: "18px", fontWeight: "600", color: "#18181b" }}>
              📍 {location}
            </div>
            <div style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid #e4e4e7", padding: "10px 20px", borderRadius: "12px", fontSize: "18px", fontWeight: "600", color: "#18181b" }}>
              💼 {workMode}
            </div>
            <div style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid #e4e4e7", padding: "10px 20px", borderRadius: "12px", fontSize: "18px", fontWeight: "600", color: "#18181b" }}>
              📝 {contract}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: brandColor,
              color: "#fff",
              padding: "14px 28px",
              borderRadius: "14px",
              fontSize: "18px",
              fontWeight: "bold",
            }}
          >
            Candidate-se online →
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
