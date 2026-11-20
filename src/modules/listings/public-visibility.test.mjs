import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";
import { sql } from "drizzle-orm";
import { alias, PgDialect } from "drizzle-orm/pg-core";

import { propertyListings } from "../../db/schema.ts";
import {
  isListingReadyForPublicDisplay,
  listingReadyForPublicDisplay,
  publicListingVisibilityCondition,
  usableListingMediaCount,
} from "./public-visibility.ts";

const complete = {
  askingPriceCents: 250000000,
  coverImageUrl: null,
  description: "A complete family home with generous living spaces and a private garden.",
  details: {
    propertyCategory: "residential",
    city: "Cape Town",
    province: "Western Cape",
    country: "South Africa",
    googlePlaceId: "test-place",
    bedrooms: 0,
    bathrooms: 1.5,
    floorSize: 120,
  },
  listingType: "sale",
  location: "Gardens, Cape Town",
  mandateType: "sole",
  media: [{ path: "listings/test/home.jpg", type: "image/jpeg" }],
  propertyType: "free_standing_house",
  title: "Family home in Gardens",
};

function row(overrides = {}, details = {}) {
  return { ...complete, ...overrides, details: { ...complete.details, ...details } };
}

const fixtures = [
  ["complete residential listing, including zero bedrooms", row(), true],
  ["complete private listing stays editable but is not publicly discoverable", row({}, { listingVisibility: "private" }), true],
  ["empty visibility setting is not publicly discoverable", row({}, { listingVisibility: "" }), true],
  ["no media", row({ media: [] }), false],
  ["null media", row({ media: null }), false],
  ["object instead of a media array", row({ media: { path: "listings/test/home.jpg" } }), false],
  ["empty and malformed media entries", row({ media: [null, {}, "image.jpg", { path: "", type: "image/jpeg" }] }), false],
  ["unsafe remote media", row({ media: [{ path: "https://example.test/home.jpg", type: "image/jpeg" }] }), false],
  ["incorrectly cased public media prefix", row({ media: [{ path: "/MEDIA/listings/test/home.jpg", type: "image/jpeg" }] }), false],
  ["path traversal media", row({ media: [{ path: "listings/../private.jpg", type: "image/jpeg" }] }), false],
  ["unknown media MIME type", row({ media: [{ path: "listings/test/home.jpg", type: "application/pdf" }] }), false],
  ["non-image extension", row({ media: [{ path: "listings/test/home.txt", type: "image/jpeg" }] }), false],
  ["video-only listing", row({ media: [{ path: "listings/test/home.mp4", type: "video/mp4" }] }), true],
  ["legacy cover-only listing", row({ media: [], coverImageUrl: "/media/listings/test/home.webp" }), true],
  ["remote cover-only listing", row({ media: [], coverImageUrl: "https://example.test/home.jpg" }), false],
  ["placeholder title", row({ title: "Untitled listing" }), false],
  ["short title", row({ title: "abc" }), false],
  ["placeholder location", row({ location: "Location not set" }), false],
  ["missing country", row({}, { country: "" }), false],
  ["missing Google location and manual address", row({}, { googlePlaceId: "" }), false],
  ["complete manual address", row({}, { googlePlaceId: "", streetName: "Long Street", suburb: "Gardens", postalCode: "8001" }), true],
  ["empty HTML description", row({ description: "<p>&nbsp;</p>" }), false],
  ["description padded only by line breaks", row({ description: "a" + "<br>".repeat(40) + "b" }), false],
  ["short description", row({ description: "A small home." }), false],
  ["missing price", row({ askingPriceCents: null }), false],
  ["zero price", row({ askingPriceCents: 0 }), false],
  ["missing property category", row({}, { propertyCategory: "" }), false],
  ["incompatible category", row({}, { propertyCategory: "commercial" }), false],
  ["incompatible mandate", row({ mandateType: "rental" }), false],
  ["missing bedrooms", row({}, { bedrooms: null }), false],
  ["invalid bathroom value", row({}, { bathrooms: "none" }), false],
  ["object instead of a numeric fact", row({}, { bathrooms: { value: 2 } }), false],
  ["zero floor size", row({}, { floorSize: 0 }), false],
  ["formatted numeric facts", row({}, { floorSize: "1 200,50 m²", bathrooms: "1,5" }), true],
  ["complete office", row({ propertyType: "office" }, { propertyCategory: "commercial", bedrooms: null, bathrooms: null }), true],
  ["office with missing floor size", row({ propertyType: "office" }, { propertyCategory: "commercial", floorSize: null }), false],
  ["complete vacant land", row({ propertyType: "vacant_land" }, { propertyCategory: "land", erfSize: 700, floorSize: null, bedrooms: null, bathrooms: null }), true],
  ["vacant land missing erf size", row({ propertyType: "vacant_land" }, { propertyCategory: "land", erfSize: null }), false],
  ["farm with hectares", row({ propertyType: "farm" }, { propertyCategory: "farm", landSizeHectares: 2, erfSize: null }), true],
  ["farm with erf size", row({ propertyType: "farm" }, { propertyCategory: "farm", landSizeHectares: null, erfSize: 20000 }), true],
  ["farm missing land size", row({ propertyType: "farm" }, { propertyCategory: "farm", landSizeHectares: null, erfSize: null }), false],
];

test("public readiness hides incomplete records and accepts complete property categories", () => {
  for (const [name, listing, expected] of fixtures) {
    assert.equal(isListingReadyForPublicDisplay(listing), expected, name);
  }
});

test("media counting ignores unusable entries and accepts local covers and videos", () => {
  assert.equal(usableListingMediaCount([
    { path: "listings/test/home.jpg", type: "image/jpeg" },
    { path: "listings/test/home.jpg", type: "image/jpeg" },
    { path: "listings/test/home.mp4", type: "video/mp4" },
    { path: "https://example.test/home.jpg", type: "image/jpeg" },
    { path: "listings//test/home.jpg", type: "image/jpeg" },
  ], "listings/test/home.jpg"), 2);
});

test("readiness SQL supports aliases without changing status or owner access", () => {
  const dialect = new PgDialect();
  const compiled = dialect.sqlToQuery(listingReadyForPublicDisplay(alias(propertyListings, "pl")));
  const visibility = dialect.sqlToQuery(publicListingVisibilityCondition(alias(propertyListings, "pl")));

  assert.match(compiled.sql, /"pl"\."media"/);
  assert.doesNotMatch(compiled.sql, /"property_listings"|"status"|listingVisibility/);
  assert.match(visibility.sql, /listingVisibility', 'public'\) = 'public'/);
});

const databaseUrl = process.env.LISTING_VISIBILITY_TEST_DATABASE_URL || process.env.DATABASE_URL;
const isLocalDatabase = databaseUrl && ["localhost", "127.0.0.1", "::1"].includes(new URL(databaseUrl).hostname);

test("PostgreSQL and JavaScript apply identical readiness and privacy rules", { skip: !isLocalDatabase }, async () => {
  const database = postgres(databaseUrl, { max: 1, prepare: false });
  const dialect = new PgDialect();
  const table = alias(propertyListings, "pl");

  try {
    for (const [name, listing, expected] of fixtures) {
      const record = {
        asking_price_cents: listing.askingPriceCents,
        cover_image_url: listing.coverImageUrl,
        description: listing.description,
        details: listing.details,
        listing_type: listing.listingType,
        location: listing.location,
        mandate_type: listing.mandateType,
        media: listing.media,
        property_type: listing.propertyType,
        title: listing.title,
      };
      const query = dialect.sqlToQuery(sql`
        select coalesce(${listingReadyForPublicDisplay(table)}, false) as ready,
          coalesce(${publicListingVisibilityCondition(table)}, false) as visible
        from jsonb_to_record(${JSON.stringify(record)}::jsonb) as pl(
          asking_price_cents bigint, cover_image_url text, description text, details jsonb,
          listing_type text, location text, mandate_type text, media jsonb, property_type text, title text
        )
      `.inlineParams());
      const [result] = await database.unsafe(query.sql);

      assert.equal(result.ready, expected, name + " (SQL)");
      assert.equal(result.ready, isListingReadyForPublicDisplay(listing), name + " (SQL/JS parity)");
      assert.equal(result.visible, expected && (listing.details.listingVisibility ?? "public") === "public", name + " (public visibility)");
    }
  } finally {
    await database.end();
  }
});
