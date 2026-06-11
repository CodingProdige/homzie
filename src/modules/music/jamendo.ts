import type { ExternalTrack } from "./types";

type JamendoTrack = {
  id: string;
  name: string;
  artist_name: string;
  audio: string;
  image: string;
  duration: number;
  musicinfo?: {
    tags?: {
      genres?: string[];
    };
  };
};

type JamendoResponse = {
  results: JamendoTrack[];
};

export async function searchJamendoMusic(
  query: string,
  page = 1,
  clientIdOverride?: string,
  tag?: string,
): Promise<ExternalTrack[]> {
  const clientId = clientIdOverride || process.env.JAMENDO_CLIENT_ID;

  if (!clientId) {
    return [];
  }

  const offset = (page - 1) * 20;

  const params = new URLSearchParams({
    client_id: clientId,
    format: "json",
    limit: "20",
    offset: String(offset),
    include: "musicinfo",
    groupby: "artist_id",
  });

  if (query) {
    params.set("search", query);
    params.set("order", "relevance_desc");
  } else {
    params.set("order", "popularity_month_desc");
  }

  if (tag) {
    params.set("tags", tag);
  }

  params.set("audioformat", "mp32");

  const res = await fetch(
    `https://api.jamendo.com/v3.0/tracks/?${params}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => res.status.toString());
    throw new Error(`Jamendo ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as JamendoResponse;

  return (data.results ?? []).flatMap((track) => {
    if (!track.audio) return [];
    return [
      {
        id: `jamendo_${track.id}`,
        title: track.name,
        artist: track.artist_name,
        audioUrl: track.audio,
        coverUrl: track.image || null,
        durationSeconds: Math.round(track.duration),
        tags: track.musicinfo?.tags?.genres ?? [],
      },
    ];
  });
}
