import { ReelsFeed } from "@/modules/reels/components/reels-feed";
import { mockReels } from "@/modules/reels/data/mock-reels";

export default function ReelsPage() {
  return <ReelsFeed reels={mockReels} scope="global" />;
}
