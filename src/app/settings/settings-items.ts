import {
  Bell,
  BellRing,
  LockKeyhole,
  Settings2,
  SlidersHorizontal,
  Trash2,
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
    href: "#",
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
    href: "#",
    destructive: false,
  },
  {
    label: "Preferences",
    description: "Manage your language, timezone and experience.",
    icon: SlidersHorizontal,
    href: "#",
    destructive: false,
  },
  {
    label: "Delete account",
    description: "Permanently delete your account and all your data.",
    icon: Trash2,
    href: "#",
    destructive: true,
  },
] as const;

export { BellRing, Settings2, TrendingUp, UserRound };
