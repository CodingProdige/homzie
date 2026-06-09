import {
  Bell,
  BellRing,
  LockKeyhole,
  Megaphone,
  Settings2,
  TrendingUp,
  User,
  UserRound,
  WalletCards,
} from "lucide-react";

export const settingsItems = [
  {
    label: "Profile settings",
    description: "Manage your profile photo, bio and public profile.",
    icon: User,
    href: "/settings/profile-settings",
    destructive: false,
  },
  {
    label: "Notifications",
    description: "Choose what you want to be notified about.",
    icon: Bell,
    href: "/settings/notifications",
    destructive: false,
  },
  {
    label: "Ads Center",
    description: "Plan and manage campaigns for your profile, listings and reels.",
    icon: Megaphone,
    href: "/settings/ads-center",
    destructive: false,
  },
  {
    label: "Billing & payments",
    description: "View your payment methods and transaction history.",
    icon: WalletCards,
    href: "/settings/billing",
    destructive: false,
  },
  {
    label: "Privacy",
    description: "Control who can see your information and activity.",
    icon: LockKeyhole,
    href: "/settings/privacy",
    destructive: false,
  },
] as const;

export { BellRing, Settings2, TrendingUp, UserRound };
