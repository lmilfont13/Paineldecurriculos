import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const upload = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => upload(...a),
        createSignedUrl: async () => ({ data: { signedUrl: "https://storage.example/poster.jpg" } }),
      }),
    },
  }),
}));

import { instagramApiBase } from "@/server/models/instagram.model";
import { publishToInstagramFeed, verifyInstagramConnection } from "./instagram-publish.service";

const fetchMock = vi.fn();

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  fetchMock.mockReset();
  upload.mockReset();
  upload.mockResolvedValue({ error: null });
  vi.stubGlobal("fetch", fetchMock);
});

describe("instagramApiBase", () => {
  it("token do Login do Instagram vai para graph.instagram.com; o do Facebook, para graph.facebook.com", () => {
    expect(instagramApiBase("IGAAabc")).toMatch(/^https:\/\/graph\.instagram\.com\/v\d+\.0$/);
    expect(instagramApiBase("EAAabc")).toMatch(/^https:\/\/graph\.facebook\.com\/v\d+\.0$/);
  });
});

describe("verifyInstagramConnection", () => {
  it("com token IG… descobre o ID da conta sozinho", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ user_id: "1784", username: "tarhgetfortaleza" }))
      .mockResolvedValueOnce(json({ username: "tarhgetfortaleza", name: "Tarhget Fortaleza" }));
    const res = await verifyInstagramConnection({ accessToken: "IGAAxyz" });
    expect(res).toMatchObject({ ok: true, username: "tarhgetfortaleza" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("graph.instagram.com");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/1784?");
  });
});

describe("publishToInstagramFeed", () => {
  it("envia JPEG (único formato aceito pelo Instagram) para o host certo", async () => {
    const png = await sharp({ create: { width: 20, height: 20, channels: 4, background: "#e6cfa6" } }).png().toBuffer();
    fetchMock
      .mockResolvedValueOnce(json({ id: "container-1" }))
      .mockResolvedValueOnce(json({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(json({ id: "media-1" }))
      .mockResolvedValueOnce(json({ permalink: "https://www.instagram.com/p/abc/" }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const promise = publishToInstagramFeed({
      imageBase64: `data:image/png;base64,${png.toString("base64")}`,
      caption: "Vaga",
      accountId: "1784",
      accessToken: "IGAAxyz",
    });
    await vi.advanceTimersByTimeAsync(5000);
    const res = await promise;
    vi.useRealTimers();

    expect(res).toMatchObject({ success: true, mediaId: "media-1" });
    const [path, buffer, opts] = upload.mock.calls[0] as [string, Buffer, { contentType: string }];
    expect(path).toMatch(/\.jpg$/);
    expect(opts.contentType).toBe("image/jpeg");
    expect([...buffer.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]); // assinatura JPEG
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${instagramApiBase("IGAAxyz")}/1784/media`);
  });

  it("sem token, pede configuração", async () => {
    const res = await publishToInstagramFeed({ imageBase64: "data:image/png;base64,AA==", caption: "x" });
    expect(res).toMatchObject({ success: false, needsConfig: true });
  });
});
