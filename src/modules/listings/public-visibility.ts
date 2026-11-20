import { and, sql, type SQL, type SQLWrapper } from "drizzle-orm";

import { propertyListings } from "@/db/schema";
import { isSafeMediaPath } from "@/media/paths";
import {
  commercialPropertyTypes,
  getListingPublishIssues,
  landOnlyPropertyTypes,
  residentialPropertyTypes,
  type ListingValidationDraft,
} from "@/modules/listings/listing-validation";
import { mandateTypeOptions, propertyTypeOptions } from "@/modules/listings/options";

type ListingVisibilityColumnName =
  | "askingPriceCents"
  | "coverImageUrl"
  | "description"
  | "details"
  | "listingType"
  | "location"
  | "mandateType"
  | "media"
  | "propertyType"
  | "title";

export type ListingVisibilityColumns = {
  [Key in ListingVisibilityColumnName]: SQLWrapper;
};

export type ListingPublicDisplayRow = {
  askingPriceCents: number | string | null;
  coverImageUrl?: string | null;
  description: string | null;
  details: unknown;
  listingType: string;
  location: string | null;
  mandateType?: string | null;
  media: unknown;
  propertyType: string;
  title: string;
};

const imageExtensionPattern = "[.](jpe?g|png|webp|gif|avif|svg|bmp|ico)$";
const videoExtensionPattern = "[.](mp4|mov|webm|m4v|ogv)$";
const safeStoredPathPattern = "^(/media/)?[a-zA-Z0-9][a-zA-Z0-9/_-]*[.][a-zA-Z0-9]+$";

function usableMediaPath(path: unknown, kind: "image" | "video") {
  return (
    typeof path === "string" &&
    isSafeMediaPath(path) &&
    new RegExp(kind === "image" ? imageExtensionPattern : videoExtensionPattern, "i").test(path)
  );
}

/** A legacy cover image is still media, even if it predates the media array. */
export function usableListingMediaCount(media: unknown, coverImageUrl?: string | null) {
  const paths = new Set<string>();

  if (usableMediaPath(coverImageUrl, "image")) paths.add(coverImageUrl!);

  if (Array.isArray(media)) {
    for (const item of media) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const { path, type } = item as Record<string, unknown>;
      const kind = typeof type === "string" && type.startsWith("image/")
        ? "image"
        : typeof type === "string" && type.startsWith("video/") ? "video" : null;

      if (kind && usableMediaPath(path, kind)) paths.add(String(path));
    }
  }

  return paths.size;
}

export function isListingReadyForPublicDisplay(row: ListingPublicDisplayRow) {
  const details = row.details && typeof row.details === "object" && !Array.isArray(row.details)
    ? row.details as Record<string, unknown>
    : {};
  const draft = {
    ...details,
    askingPrice: row.askingPriceCents,
    description: row.description,
    listingType: row.listingType,
    location: row.location,
    mandateType: row.mandateType,
    propertyType: row.propertyType,
    title: row.title,
  } as ListingValidationDraft;

  return getListingPublishIssues(
    draft,
    usableListingMediaCount(row.media, row.coverImageUrl),
  ).length === 0;
}

function trimmed(value: SQLWrapper) {
  return sql`regexp_replace(coalesce(${value}, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g')`;
}

function detailText(table: ListingVisibilityColumns, key: string) {
  return trimmed(sql`${table.details}->>${key}`);
}

function inValues(value: SQLWrapper, values: readonly string[]) {
  return sql`${value} in (${sql.join(values.map((item) => sql`${item}`), sql`, `)})`;
}

/** Mirrors parseListingNumberInput for numeric facts already persisted as JSON. */
function detailNumber(table: ListingVisibilityColumns, key: string) {
  const raw = detailText(table, key);

  return sql`(
    select case
      when normalized.value ~ '^[0-9]+([.][0-9]*)?$'
        and length(normalized.value) <= 1000
      then case
        when normalized.value::numeric <= 1.7976931348623157e308
        then (case when left(source.raw, 1) = '-' then -1 else 1 end) * normalized.value::numeric
        else null
      end
      else null
    end
    from (select ${raw} as raw, case
      when jsonb_typeof(${table.details}->${key}) in ('string', 'number')
      then regexp_replace(${raw}, '[^0-9.,]', '', 'g') else '' end as clean) source
    cross join lateral (
      select case
        when strpos(source.clean, '.') > 0 and strpos(source.clean, ',') > 0
          then case when strpos(reverse(source.clean), '.') < strpos(reverse(source.clean), ',') then '.' else ',' end
        when strpos(source.clean, '.') > 0 and strpos(reverse(source.clean), '.') between 2 and 3 then '.'
        when strpos(source.clean, ',') > 0 and strpos(reverse(source.clean), ',') between 2 and 3 then ','
        else null
      end as separator
    ) decimal_mark
    cross join lateral (
      select case when decimal_mark.separator is null
        then regexp_replace(source.clean, '[.,]', '', 'g')
        else coalesce(nullif(regexp_replace(left(source.clean, length(source.clean) - strpos(reverse(source.clean), decimal_mark.separator)), '[.,]', '', 'g'), ''), '0')
          || '.' || right(source.clean, strpos(reverse(source.clean), decimal_mark.separator) - 1)
      end as value
    ) normalized
  )`;
}

function usablePathSql(value: SQLWrapper, extensionPattern: string) {
  return sql`(${value} ~ ${safeStoredPathPattern}
    and ${value} not like '%//%'
    and ${value} ~* ${extensionPattern})`;
}

/** Readiness only: callers retain their own status and access rules. */
export function listingReadyForPublicDisplay(
  table: ListingVisibilityColumns = propertyListings,
): SQL {
  const category = detailText(table, "propertyCategory");
  const propertyType = trimmed(table.propertyType);
  const listingType = trimmed(table.listingType);
  const mandateType = trimmed(table.mandateType);
  const title = trimmed(table.title);
  const location = trimmed(table.location);
  const description = trimmed(sql`regexp_replace(replace(replace(replace(replace(
    regexp_replace(regexp_replace(coalesce(${table.description}, ''), ${"</?(p|br|li|ul|ol)[^>]*>"}, ${"\n"}, 'gi'), '<[^>]+>', '', 'g'),
    '&nbsp;', ' '), '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), ${"\n{3,}"}, ${"\n\n"}, 'g')`);
  const floorSize = detailNumber(table, "floorSize");
  const erfSize = detailNumber(table, "erfSize");
  const landSize = detailNumber(table, "landSizeHectares");
  const residential = inValues(propertyType, [...residentialPropertyTypes]);
  const commercial = inValues(propertyType, [...commercialPropertyTypes]);
  const land = inValues(propertyType, [...landOnlyPropertyTypes]);
  const categories = [...new Set(propertyTypeOptions.map((option) => option.category))];
  const categoryCompatibility = categories.map((allowedCategory) => sql`(
    not ${inValues(propertyType, propertyTypeOptions.filter((option) => option.category === allowedCategory).map((option) => option.value))}
    or ${category} = ${allowedCategory}
  )`);

  return and(
    sql`length(${listingType}) > 0`,
    sql`length(${category}) > 0`,
    sql`length(${propertyType}) > 0`,
    ...categoryCompatibility,
    sql`(${mandateType} = '' or case ${listingType}
      when 'sale' then ${inValues(mandateType, ["open", "sole", "dual", "development"])}
      when 'rental' then ${inValues(mandateType, ["open", "sole", "rental"])}
      else ${inValues(mandateType, mandateTypeOptions.map((option) => option.value))}
    end)`,
    sql`length(${title}) >= 4 and ${title} <> 'Untitled listing'`,
    sql`length(${location}) >= 2 and ${location} <> 'Location not set'`,
    ...["city", "province", "country"].map((key) => sql`length(${detailText(table, key)}) > 0`),
    sql`(length(${detailText(table, "googlePlaceId")}) > 0 or (
      length(${detailText(table, "streetName")}) > 0
      and length(${detailText(table, "suburb")}) > 0
      and length(${detailText(table, "postalCode")}) > 0
    ))`,
    sql`length(${description}) >= 40`,
    sql`(not ${residential} or (${detailNumber(table, "bedrooms")} is not null and ${detailNumber(table, "bathrooms")} is not null and ${floorSize} > 0))`,
    sql`(not ${commercial} or ${floorSize} > 0)`,
    sql`(not ${land} or case when ${category} = 'farm' then (${landSize} > 0 or ${erfSize} > 0) else ${erfSize} > 0 end)`,
    sql`${table.askingPriceCents} > 0`,
    sql`(${usablePathSql(table.coverImageUrl, imageExtensionPattern)} or exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(${table.media}) = 'array' then ${table.media} else '[]'::jsonb end) as public_listing_media(item)
      where (public_listing_media.item->>'type' like 'image/%' and ${usablePathSql(sql`public_listing_media.item->>'path'`, imageExtensionPattern)})
        or (public_listing_media.item->>'type' like 'video/%' and ${usablePathSql(sql`public_listing_media.item->>'path'`, videoExtensionPattern)})
    ))`,
  )!;
}

export function publicListingVisibilityCondition(
  table: ListingVisibilityColumns = propertyListings,
): SQL {
  return and(
    listingReadyForPublicDisplay(table),
    sql`coalesce(${table.details}->>'listingVisibility', 'public') = 'public'`,
  )!;
}
