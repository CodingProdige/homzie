import type { ExternalTrack } from "./types";

type PixabayMusicHit = {
  id: number;
  title: string;
  user: string;
  audio_url: string;
  thumbnail_url?: string;
  duration: number;
  tags: string;
};

type PixabayMusicResponse = {
  total: number;
  totalHits: number;
  hits: PixabayMusicHit[];
};

export async function searchPixabayMusic(
  query: string,
  page = 1,
  apiKeyOverride?: string,
  category?: string,
): Promise<ExternalTrack[]> {
  const apiKey = apiKeyOverride || process.env.PIXABAY_API_KEY;

  if (!apiKey) {
    return [];
  }

  const effectiveQuery = [category, query].filter(Boolean).join(" ") || "background music";

  const params = new URLSearchParams({
    key: apiKey,
    q: effectiveQuery,
    per_page: "20",
    page: String(page),
    order: query || category ? "popular" : "latest",
  });

  const res = await fetch(`https://pixabay.com/api/music/?${params}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.status.toString());
    throw new Error(`Pixabay ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as PixabayMusicResponse;

  return (data.hits ?? []).map((hit) => ({
    id: `pixabay_${hit.id}`,
    title: hit.title,
    artist: hit.user,
    audioUrl: hit.audio_url,
    coverUrl: hit.thumbnail_url ?? null,
    durationSeconds: hit.duration,
    tags: hit.tags.split(",").map((t) => t.trim()).filter(Boolean),
  }));
}
