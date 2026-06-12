import type { Metadata } from "next";

import {
  generatePropertyLandingMetadata,
  PropertyLandingPage,
} from "@/modules/seo/property-landing";

type Props = {
  params: Promise<{ listingType: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { listingType } = await params;

  return generatePropertyLandingMetadata({ listingType });
}

export default async function PropertyTypePage({ params }: Props) {
  const { listingType } = await params;

  return <PropertyLandingPage listingType={listingType} />;
}
