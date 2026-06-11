import { eq } from "drizzle-orm";

import { db } from "@/db";
import { locationPopulationCache } from "@/db/schema";

const POPULATION_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 120;
const WIKIDATA_SEARCH_ENDPOINT = "https://www.wikidata.org/w/api.php";
const WIKIDATA_ENTITY_ENDPOINT = "https://www.wikidata.org/wiki/Special:EntityData";

type PopulationResolution = {
  populationEstimate: number;
  source: string | null;
  sourceEntityId: string | null;
};

type WikidataSearchResponse = {
  search?: Array<{
    description?: string;
    id?: string;
    label?: string;
    match?: {
      type?: string;
    };
  }>;
};

type WikidataPopulationClaim = {
  mainsnak?: {
    datavalue?: {
      value?: {
        amount?: string;
      };
    };
  };
  qualifiers?: Record<
    string,
    Array<{
      datavalue?: {
        value?: {
          time?: string;
        };
      };
    }>
  >;
  rank?: string;
};

type WikidataEntityResponse = {
  entities?: Record<
    string,
    {
      claims?: Record<string, WikidataPopulationClaim[]>;
    }
  >;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function splitLocationLabel(label: string) {
  return label
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function candidateQueries(label: string) {
  const parts = splitLocationLabel(label);
  const first = parts[0];
  const firstTwo = parts.slice(0, 2).join(", ");

  return Array.from(
    new Set(
      [label.trim(), first, firstTwo]
        .map((entry) => entry?.trim())
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
}

function scoreSearchResult(
  label: string,
  result: NonNullable<WikidataSearchResponse["search"]>[number],
) {
  const normalizedLabel = normalizeText(label);
  const firstPart = normalizeText(splitLocationLabel(label)[0] || label);
  const resultLabel = normalizeText(result.label || "");
  const resultDescription = normalizeText(result.description || "");
  const placeHint =
    /(city|town|suburb|country|municipality|province|state|region|village|district|county)/;

  let score = 0;

  if (resultLabel === normalizedLabel) score += 12;
  if (resultLabel === firstPart) score += 10;
  if (normalizedLabel.includes(resultLabel) || resultLabel.includes(firstPart)) score += 5;
  if (result.match?.type === "label") score += 2;
  if (placeHint.test(resultDescription)) score += 4;

  return score;
}

function parsePopulationAmount(value?: string) {
  if (!value) return null;
  const normalized = value.replace(/^\+/, "");
  const amount = Number.parseInt(normalized, 10);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function extractPopulationFromClaims(claims?: Record<string, WikidataPopulationClaim[]>) {
  const populationClaims = claims?.P1082;

  if (!populationClaims?.length) {
    return null;
  }

  const sortedClaims = [...populationClaims].sort((a, b) => {
    const rankOrder = (rank?: string) =>
      rank === "preferred" ? 2 : rank === "normal" ? 1 : 0;
    const rankDiff = rankOrder(b.rank) - rankOrder(a.rank);

    if (rankDiff !== 0) return rankDiff;

    const timeValue = (claim: WikidataPopulationClaim) =>
      claim.qualifiers?.P585?.[0]?.datavalue?.value?.time || "";

    return timeValue(b).localeCompare(timeValue(a));
  });

  for (const claim of sortedClaims) {
    const amount = parsePopulationAmount(
      claim.mainsnak?.datavalue?.value?.amount,
    );

    if (amount) {
      return amount;
    }
  }

  return null;
}

async function searchWikidata(query: string) {
  const response = await fetch(
    `${WIKIDATA_SEARCH_ENDPOINT}?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=5&origin=*`,
    {
      headers: {
        Accept: "application/json",
      },
      next: {
        revalidate: 60 * 60 * 24 * 30,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Wikidata search failed with ${response.status}.`);
  }

  return (await response.json()) as WikidataSearchResponse;
}

async function fetchEntityPopulation(entityId: string) {
  const response = await fetch(`${WIKIDATA_ENTITY_ENDPOINT}/${entityId}.json`, {
    headers: {
      Accept: "application/json",
    },
    next: {
      revalidate: 60 * 60 * 24 * 30,
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata entity lookup failed with ${response.status}.`);
  }

  const payload = (await response.json()) as WikidataEntityResponse;
  const entity = payload.entities?.[entityId];

  return extractPopulationFromClaims(entity?.claims);
}

async function resolvePopulationFromWikidata(label: string): Promise<PopulationResolution> {
  const queries = candidateQueries(label);

  for (const query of queries) {
    const searchPayload = await searchWikidata(query);
    const candidates = (searchPayload.search || [])
      .filter((result): result is NonNullable<typeof result> & { id: string } => Boolean(result.id))
      .map((result) => ({
        ...result,
        score: scoreSearchResult(label, result),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    for (const candidate of candidates) {
      const populationEstimate = await fetchEntityPopulation(candidate.id);

      if (populationEstimate) {
        return {
          populationEstimate,
          source: "wikidata",
          sourceEntityId: candidate.id,
        };
      }
    }
  }

  return {
    populationEstimate: 0,
    source: "wikidata",
    sourceEntityId: null,
  };
}

async function writePopulationCache({
  label,
  placeId,
  resolution,
}: {
  label: string;
  placeId: string;
  resolution: PopulationResolution;
}) {
  const now = new Date();

  await db
    .insert(locationPopulationCache)
    .values({
      placeId,
      label,
      populationEstimate: resolution.populationEstimate,
      source: resolution.source,
      sourceEntityId: resolution.sourceEntityId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: locationPopulationCache.placeId,
      set: {
        label,
        populationEstimate: resolution.populationEstimate,
        source: resolution.source,
        sourceEntityId: resolution.sourceEntityId,
        updatedAt: now,
      },
    });
}

export async function getTargetAreaPopulationEstimate({
  label,
  placeId,
}: {
  label: string;
  placeId: string;
}) {
  const [cached] = await db
    .select()
    .from(locationPopulationCache)
    .where(eq(locationPopulationCache.placeId, placeId))
    .limit(1);

  if (
    cached?.updatedAt &&
    Date.now() - cached.updatedAt.getTime() < POPULATION_CACHE_TTL_MS
  ) {
    return cached.populationEstimate;
  }

  try {
    const resolution = await resolvePopulationFromWikidata(label);
    await writePopulationCache({
      label,
      placeId,
      resolution,
    });

    return resolution.populationEstimate;
  } catch {
    return cached?.populationEstimate || 0;
  }
}
