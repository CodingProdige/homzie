import type { Metadata } from "next";

import {
  generatePropertyLandingMetadata,
  PropertyLandingPage,
} from "@/modules/seo/property-landing";

type Props = {
  params: Promise<{ listingType: string; province: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { listingType, province } = await params;

  return generatePropertyLandingMetadata({ listingType, province });
}

export default async function PropertyProvincePage({ params }: Props) {
  const { listingType, province } = await params;

  return <PropertyLandingPage listingType={listingType} province={province} />;
}
