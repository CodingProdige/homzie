export function buildReelPath(reelId: string) {
  return `/reels/${encodeURIComponent(reelId)}`;
}
