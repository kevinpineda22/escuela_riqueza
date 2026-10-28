import { describe, expect, it, vi } from "vitest";
import { firstVariantUrl, liveManifestUrl, playlistDuration, probeDvrDuration } from "./dvrWindow";

const MASTER = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
stream_t1.m3u8?dvrEnabled=true
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
stream_t2.m3u8?dvrEnabled=true
`;

const MEDIA = `#EXTM3U
#EXT-X-TARGETDURATION:2
#EXTINF:2.000,
seg1.ts
#EXTINF:2.000,
seg2.ts
#EXTINF:1.500,
seg3.ts
`;

describe("liveManifestUrl", () => {
  it("arma el manifiesto de cada modo", () => {
    expect(liveManifestUrl("abc", "in1", "smooth")).toBe("https://customer-abc.cloudflarestream.com/in1/manifest/video.m3u8");
    expect(liveManifestUrl("abc", "in1", "dvr")).toContain("?dvrEnabled=true");
    expect(liveManifestUrl("abc", "in1", "low")).toContain("?protocol=llhls");
  });
});

describe("playlistDuration", () => {
  it("suma los EXTINF", () => {
    expect(playlistDuration(MEDIA)).toBe(5.5);
  });
});

describe("firstVariantUrl", () => {
  it("resuelve la primera variante contra la URL de la maestra", () => {
    expect(firstVariantUrl(MASTER, "https://h.example/in1/manifest/video.m3u8?dvrEnabled=true")).toBe(
      "https://h.example/in1/manifest/stream_t1.m3u8?dvrEnabled=true",
    );
  });

  it("una playlist de medios no tiene variantes", () => {
    expect(firstVariantUrl(MEDIA, "https://h.example/x.m3u8")).toBeNull();
  });
});

describe("probeDvrDuration", () => {
  it("lee la maestra, después la variante, y devuelve la duración", async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) =>
      new Response(String(url).includes("stream_t1") ? MEDIA : MASTER, { status: 200 }),
    ) as unknown as typeof fetch;
    expect(await probeDvrDuration("https://h.example/in1/manifest/video.m3u8?dvrEnabled=true", fetchFn)).toBe(5.5);
  });

  it("ante un error de red devuelve null", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await probeDvrDuration("https://h.example/x.m3u8", fetchFn)).toBeNull();
  });
});
