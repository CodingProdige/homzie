import type { Metadata } from "next";

import {
  generatePropertyLandingMetadata,
  PropertyLandingPage,
} from "@/modules/seo/property-landing";

type Props = {
  params: Promise<{ city: string; listingType: string; province: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, listingType, province } = await params;

  return generatePropertyLandingMetadata({ city, listingType, province });
}

export default async function PropertyCityPage({ params }: Props) {
  const { city, listingType, province } = await params;

  return (
    <PropertyLandingPage
      city={city}
      listingType={listingType}
      province={province}
    />
  );
}
