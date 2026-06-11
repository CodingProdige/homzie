import { AdsCenterClient } from "./ads-center-client";
import { getAdsCenterPageData } from "./data";

export default async function AdsCenterPage() {
  const data = await getAdsCenterPageData();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1180px] overflow-x-clip bg-background px-4 pb-10 text-foreground sm:px-6 lg:px-10">
      <AdsCenterClient {...data} />
    </main>
  );
}
