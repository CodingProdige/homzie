export type Reel = {
  id: string;
  agentName: string;
  agentUsername: string;
  title: string;
  location: string;
  price: string;
  beds: string;
  baths: string;
  size: string;
  likes: string;
  comments: string;
  shares: string;
  colorA: string;
  colorB: string;
  listingId?: string;
};

export const mockReels: Reel[] = [
  {
    id: "clifton-modern-villa",
    agentName: "Dillon Jurgens",
    agentUsername: "dillonjurgens",
    title: "Ultra Modern Villa",
    location: "Clifton, Cape Town",
    price: "R 24,500,000",
    beds: "4",
    baths: "4.5",
    size: "800m2",
    likes: "2.4K",
    comments: "156",
    shares: "358",
    colorA: "#172541",
    colorB: "#f5a05b",
    listingId: "ultra-modern-villa",
  },
  {
    id: "umhlanga-penthouse",
    agentName: "Dillon Jurgens",
    agentUsername: "dillonjurgens",
    title: "Penthouse with ocean views",
    location: "Umhlanga, KZN",
    price: "R 12,900,000",
    beds: "3",
    baths: "3",
    size: "320m2",
    likes: "1.8K",
    comments: "94",
    shares: "211",
    colorA: "#213547",
    colorB: "#6eb7d4",
    listingId: "umhlanga-penthouse",
  },
  {
    id: "steyn-city-family-home",
    agentName: "Nokuthula M.",
    agentUsername: "nokuthulam",
    title: "Family home in Steyn City",
    location: "Steyn City, Johannesburg",
    price: "R 8,750,000",
    beds: "4",
    baths: "3.5",
    size: "510m2",
    likes: "3.1K",
    comments: "188",
    shares: "402",
    colorA: "#1e1a2e",
    colorB: "#a372ff",
    listingId: "steyn-city-family",
  },
  {
    id: "sea-point-apartment",
    agentName: "Jason V.",
    agentUsername: "jasonv",
    title: "Sea Point apartment tour",
    location: "Sea Point, Cape Town",
    price: "R 4,350,000",
    beds: "2",
    baths: "2",
    size: "118m2",
    likes: "980",
    comments: "63",
    shares: "120",
    colorA: "#24304c",
    colorB: "#ff6f91",
    listingId: "sea-point-apartment",
  },
];

export function getReelsForUser(username: string) {
  return mockReels.filter((reel) => reel.agentUsername === username);
}
