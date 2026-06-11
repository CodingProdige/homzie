import type { ExternalTrack } from "./types";

type FreesoundResult = {
  id: number;
  name: string;
  username: string;
  previews: {
    "preview-hq-mp3"?: string;
    "preview-lq-mp3"?: string;
  };
  images: {
    spectral_l?: string;
    waveform_l?: string;
  };
  duration: number;
  tags: string[];
};

type FreesoundResponse = {
  count: number;
  results: FreesoundResult[];
};

export async function searchFreesound(
  query: string,
  page = 1,
  apiKeyOverride?: string,
  tag?: string,
): Promise<ExternalTrack[]> {
  const apiKey = apiKeyOverride || process.env.FREESOUND_API_KEY;

  if (!apiKey) {
    return [];
  }

  const filter = tag
    ? `tag:${tag} duration:[5 TO 300]`
    : "duration:[5 TO 300]";

  const params = new URLSearchParams({
    token: apiKey,
    query: query || "background music",
    page_size: "20",
    page: String(page),
    filter,
    fields: "id,name,username,previews,images,duration,tags",
    sort: query ? "score" : "downloads_desc",
  });

  const res = await fetch(
    `https://freesound.org/apiv2/search/text/?${params}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => res.status.toString());
    throw new Error(`Freesound ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as FreesoundResponse;

  return (data.results ?? []).flatMap((result) => {
    const audioUrl =
      result.previews?.["preview-hq-mp3"] ??
      result.previews?.["preview-lq-mp3"];
    if (!audioUrl) return [];
    return [
      {
        id: `freesound_${result.id}`,
        title: result.name,
        artist: result.username,
        audioUrl,
        coverUrl: result.images?.waveform_l ?? result.images?.spectral_l ?? null,
        durationSeconds: Math.round(result.duration),
        tags: result.tags ?? [],
      },
    ];
  });
}
