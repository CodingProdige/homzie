export type AgentReel = {
  id: string;
  title: string;
  views: string;
  imageUrl: string;
  listingId?: string;
};

export type AgentListing = {
  id: string;
  label: string;
  imageUrl: string;
  price: string;
  title: string;
  location: string;
  bedrooms: string;
  bathrooms: string;
  garages: string;
};

export type AgentHighlight = {
  title: string;
  imageUrl: string;
};

export type AgentTestimonial = {
  quote: string;
  author: string;
  location: string;
  imageUrl: string;
};

export const agentProfile = {
  name: "Jessica van der Merwe",
  username: "jessicavdm",
  location: "Cape Town, South Africa",
  avatarUrl:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=420&q=85",
  title: "Property Specialist",
  bio: [
    "Helping you find your perfect home.",
    "Luxury · Coastal · Investment Properties",
    "Cape Town & Surrounds",
  ],
  link: "linktr.ee/jessicavdm",
  stats: [
    { label: "Posts", value: "152" },
    { label: "Followers", value: "24.8K" },
    { label: "Following", value: "392" },
  ],
  subscriptionPrice: "R99/pm",
  highlights: [
    {
      title: "For Sale",
      imageUrl:
        "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=240&q=80",
    },
    {
      title: "Rentals",
      imageUrl:
        "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=240&q=80",
    },
    {
      title: "Client Love",
      imageUrl:
        "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=240&q=80",
    },
    {
      title: "New Listings",
      imageUrl:
        "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=240&q=80",
    },
    {
      title: "Cape Town",
      imageUrl:
        "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&w=240&q=80",
    },
    {
      title: "Investments",
      imageUrl:
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=240&q=80",
    },
  ] satisfies AgentHighlight[],
  reels: [
    {
      id: "reel-modern-villa",
      title: "Modern villa in Clifton",
      views: "12.4K",
      listingId: "clifton-villa",
      imageUrl:
        "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=640&q=85",
    },
    {
      id: "reel-penthouse",
      title: "Penthouse with unforgettable views",
      views: "9.8K",
      listingId: "bishopscourt-house",
      imageUrl:
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=640&q=85",
    },
    {
      id: "reel-development",
      title: "New development in Umhlanga",
      views: "7.6K",
      listingId: "umhlanga-development",
      imageUrl:
        "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=640&q=85",
    },
    {
      id: "reel-agent-day",
      title: "Day in the life of a property agent",
      views: "15.2K",
      imageUrl:
        "https://images.unsplash.com/photo-1580894732444-8ecded7900cd?auto=format&fit=crop&w=640&q=85",
    },
    {
      id: "reel-camps-bay",
      title: "Sea view home in Camps Bay",
      views: "8.1K",
      listingId: "camps-bay-home",
      imageUrl:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=640&q=85",
    },
    {
      id: "reel-investment",
      title: "Top 3 areas to invest in 2024",
      views: "6.3K",
      imageUrl:
        "https://images.unsplash.com/photo-1576485290814-1c72aa4bbb8e?auto=format&fit=crop&w=640&q=85",
    },
    {
      id: "reel-luxury",
      title: "Luxury living in Steyn City",
      views: "11.7K",
      listingId: "steyn-city-luxury",
      imageUrl:
        "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=640&q=85",
    },
    {
      id: "reel-behind-scenes",
      title: "Behind the scenes of a photoshoot",
      views: "5.4K",
      imageUrl:
        "https://images.unsplash.com/photo-1556912167-f556f1f39fdf?auto=format&fit=crop&w=640&q=85",
    },
  ] satisfies AgentReel[],
  listings: [
    {
      id: "clifton-villa",
      label: "For Sale",
      price: "R 12,500,000",
      title: "4 Bed House in Clifton",
      location: "Clifton, Cape Town",
      bedrooms: "4",
      bathrooms: "4.5",
      garages: "2",
      imageUrl:
        "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=640&q=85",
    },
    {
      id: "bishopscourt-house",
      label: "For Sale",
      price: "R 8,950,000",
      title: "3 Bed House in Bishopscourt",
      location: "Bishopscourt, Cape Town",
      bedrooms: "3",
      bathrooms: "3.5",
      garages: "2",
      imageUrl:
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=640&q=85",
    },
    {
      id: "waterfront-apartment",
      label: "To Rent",
      price: "R 55,000 /pm",
      title: "2 Bed Apartment in Waterfront",
      location: "Waterfront, Cape Town",
      bedrooms: "2",
      bathrooms: "2",
      garages: "1",
      imageUrl:
        "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=640&q=85",
    },
    {
      id: "umhlanga-development",
      label: "Development",
      price: "From R 2,750,000",
      title: "New Development in Umhlanga",
      location: "Umhlanga, CZN",
      bedrooms: "2-4",
      bathrooms: "2-3",
      garages: "1-2",
      imageUrl:
        "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=640&q=85",
    },
  ] satisfies AgentListing[],
  testimonials: [
    {
      quote:
        "Jessica made the process so smooth and found us our dream home. Highly recommended!",
      author: "Michael & Sarah T.",
      location: "Clifton",
      imageUrl:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
    },
    {
      quote:
        "Incredible knowledge of the market and such a pleasure to work with.",
      author: "Liam R.",
      location: "Sea Point",
      imageUrl:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80",
    },
    {
      quote:
        "Professional, responsive and really goes the extra mile for her clients.",
      author: "Natasha L.",
      location: "Constantia",
      imageUrl:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
    },
  ] satisfies AgentTestimonial[],
};
