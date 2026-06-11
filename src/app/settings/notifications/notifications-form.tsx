"use client";

import { useActionState } from "react";
import {
  Bell,
  BellRing,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  Megaphone,
  MessageCircle,
  PhoneCall,
  Save,
  UserRound,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EnableNotificationsButton } from "@/modules/push/components/enable-notifications-button";
import { emailNotificationEvents } from "@/modules/email/events";
import { SettingsPageHeader } from "../settings-page-header";
import {
  emptyNotificationPreferencesState,
  updateNotificationPreferences,
} from "./actions";

export type NotificationPreferencesFormValues = {
  callsEnabled: boolean;
  emailEnabled: boolean;
  emailEventPreferences: Record<string, boolean>;
  listingActivityEnabled: boolean;
  marketingEnabled: boolean;
  messagesEnabled: boolean;
  offersEnabled: boolean;
  profileActivityEnabled: boolean;
  pushEnabled: boolean;
  reelActivityEnabled: boolean;
};

type BooleanPreferenceKey = Exclude<
  keyof NotificationPreferencesFormValues,
  "emailEventPreferences"
>;

type PreferenceItem = {
  description: string;
  icon: typeof Bell;
  key: BooleanPreferenceKey;
  label: string;
};

const groups: Array<{
  description: string;
  items: PreferenceItem[];
  title: string;
}> = [
  {
    title: "Messages",
    description: "Conversation alerts from buyers, sellers and agents.",
    items: [
      {
        key: "messagesEnabled",
        label: "New messages",
        description: "Direct messages and conversation updates.",
        icon: MessageCircle,
      },
      {
        key: "callsEnabled",
        label: "Calls",
        description: "Incoming call alerts and missed call activity.",
        icon: PhoneCall,
      },
    ],
  },
  {
    title: "Property activity",
    description: "Signals around listings, offers and buyer interest.",
    items: [
      {
        key: "offersEnabled",
        label: "Offers",
        description: "New offers, offer updates and important deal movement.",
        icon: BellRing,
      },
      {
        key: "listingActivityEnabled",
        label: "Listings",
        description: "Saves, likes, contact events and listing engagement.",
        icon: Building2,
      },
    ],
  },
  {
    title: "Social activity",
    description: "Profile, reel and community activity.",
    items: [
      {
        key: "reelActivityEnabled",
        label: "Reels",
        description: "Likes, comments, saves and reshares.",
        icon: Video,
      },
      {
        key: "profileActivityEnabled",
        label: "Profile",
        description: "New followers and profile activity.",
        icon: UserRound,
      },
    ],
  },
  {
    title: "Email",
    description: "Inbox delivery and platform announcements.",
    items: [
      {
        key: "emailEnabled",
        label: "Email notifications",
        description: "Receive supported alerts by email.",
        icon: Mail,
      },
      {
        key: "marketingEnabled",
        label: "Product updates",
        description: "Homzie news, launches and optional marketing.",
        icon: Megaphone,
      },
    ],
  },
];

function PreferenceSwitch({
  description,
  icon: Icon,
  name,
  title,
  value,
}: {
  description: string;
  icon: typeof Bell;
  name: BooleanPreferenceKey;
  title: string;
  value: boolean;
}) {
  return (
    <label className="flex min-w-0 items-center gap-4 rounded-lg border border-border bg-background px-4 py-4 transition hover:border-primary/35 hover:bg-primary/5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-foreground">{title}</span>
        <span className="mt-1 block text-sm font-semibold leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={value}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full border border-border bg-muted transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:border-primary peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
      />
    </label>
  );
}

function EmailEventPreferencesCard({
  preferences,
}: {
  preferences: NotificationPreferencesFormValues;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-lg font-bold tracking-normal text-card-foreground">
          Email event controls
        </h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
          Fine-tune which transactional email templates can send.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {emailNotificationEvents.map((group) => (
          <div key={group.category} className="rounded-lg border border-border bg-background p-4">
            <h3 className="text-sm font-black">{group.category}</h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
              {group.description}
            </p>
            <div className="mt-3 space-y-2">
              {group.events.map((event) => (
                <label
                  key={event.key}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {event.label}
                    </span>
                    <span className="block truncate text-xs font-semibold text-muted-foreground">
                      {event.key}
                    </span>
                  </span>
                  <input
                    className="peer sr-only"
                    defaultChecked={preferences.emailEventPreferences[event.key] !== false}
                    name={`emailEvent:${event.key}`}
                    type="checkbox"
                  />
                  <span
                    aria-hidden="true"
                    className="relative h-6 w-10 shrink-0 rounded-full border border-border bg-muted transition-colors after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:border-primary peer-checked:bg-primary peer-checked:after:translate-x-4"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BrowserNotificationsCard({
  preferences,
}: {
  preferences: NotificationPreferencesFormValues;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-normal text-card-foreground">
            Browser notifications
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
            Push alerts for messages, calls and important account activity.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-bold",
            preferences.pushEnabled
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          <CheckCircle2 className="size-3.5" />
          {preferences.pushEnabled ? "Enabled" : "Paused"}
        </span>
      </div>

      <div className="mt-5">
        <PreferenceSwitch
          name="pushEnabled"
          title="Push notifications"
          description="Allow Homzie to send browser alerts from enabled categories."
          icon={Bell}
          value={preferences.pushEnabled}
        />
        <EnableNotificationsButton />
      </div>
    </section>
  );
}

export function NotificationsForm({
  preferences,
}: {
  preferences: NotificationPreferencesFormValues;
}) {
  const [state, formAction, isPending] = useActionState(
    updateNotificationPreferences,
    emptyNotificationPreferencesState,
  );

  return (
    <form action={formAction}>
      <SettingsPageHeader
        title="Notifications"
        message={state.message}
        messageTone={state.ok ? "success" : state.message ? "error" : "neutral"}
        actions={
          <Button type="submit" disabled={isPending} className="h-11 px-5 text-sm">
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save changes
          </Button>
        }
      />

      <div className="flex w-full flex-col gap-5 py-6">
        <BrowserNotificationsCard preferences={preferences} />
        <EmailEventPreferencesCard preferences={preferences} />

        {groups.map((group) => {
          return (
            <section
              key={group.title}
              className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6"
            >
              <div className="min-w-0">
                <h2 className="text-lg font-bold tracking-normal text-card-foreground">
                  {group.title}
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                  {group.description}
                </p>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {group.items.map((item) => (
                  <PreferenceSwitch
                    key={item.key}
                    name={item.key}
                    title={item.label}
                    description={item.description}
                    icon={item.icon}
                    value={preferences[item.key]}
                  />
                ))}
              </div>
            </section>
          );
        })}

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-normal text-card-foreground">
              Account alerts
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
              Security, billing and legal notices stay on.
            </p>
          </div>
        </section>
      </div>
    </form>
  );
}
