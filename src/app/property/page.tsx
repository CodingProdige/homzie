import type { Metadata } from "next";

import {
  generatePropertyLandingMetadata,
  PropertyLandingPage,
} from "@/modules/seo/property-landing";

export function generateMetadata(): Promise<Metadata> {
  return generatePropertyLandingMetadata({ listingType: "for-sale" });
}

export default function PropertyIndexPage() {
  return <PropertyLandingPage listingType="for-sale" />;
}
