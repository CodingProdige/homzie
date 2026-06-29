"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { ComponentProps } from "react";

import {
  trackGoogleAdsConversion,
  trackGoogleEvent,
} from "@/modules/analytics/gtag";

type AgentTrialLinkProps = ComponentProps<typeof Link> & {
  location: string;
};

export function AgentTrialLink({
  location,
  onClick,
  ...props
}: AgentTrialLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        trackGoogleEvent("agent_trial_cta_clicked", {
          event_category: "agent_trial",
          event_label: location,
          trial_days: 7,
        });

        if (String(props.href).startsWith("/register")) {
          trackGoogleEvent("signup_started", {
            event_category: "agent_trial",
            event_label: location,
            trial_days: 7,
          });
          trackGoogleAdsConversion("agentSignupStarted");
        }

        onClick?.(event);
      }}
    />
  );
}

export function AgentPricingViewedTracker() {
  const ref = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);

  useEffect(() => {
    const element = ref.current;

    if (!element || tracked.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || tracked.current) return;

        tracked.current = true;
        trackGoogleEvent("pricing_viewed", {
          event_category: "agent_trial",
          event_label: "agent_trial_section",
          trial_days: 7,
        });
        observer.disconnect();
      },
      { threshold: 0.45 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className="sr-only" aria-hidden="true" />;
}

export function AgentWalkthroughVideo({
  className,
}: {
  className?: string;
}) {
  const milestones = useRef(new Set<number>());
  const started = useRef(false);

  function trackVideoEvent(eventName: string, extra?: Record<string, number | string>) {
    trackGoogleEvent(eventName, {
      event_category: "agent_trial",
      event_label: "homzie_walkthrough",
      ...extra,
    });
  }

  return (
    <video
      className={className}
      src="/video/homzie-walkthrough.mp4"
      controls
      playsInline
      preload="metadata"
      onPlay={() => {
        if (started.current) return;

        started.current = true;
        trackVideoEvent("video_demo_started");
      }}
      onEnded={() => trackVideoEvent("video_demo_completed", { progress_percent: 100 })}
      onTimeUpdate={(event) => {
        const video = event.currentTarget;

        if (!video.duration || Number.isNaN(video.duration)) return;

        const percent = Math.floor((video.currentTime / video.duration) * 100);
        const milestone = [25, 50, 75].find(
          (value) => percent >= value && !milestones.current.has(value),
        );

        if (!milestone) return;

        milestones.current.add(milestone);
        trackVideoEvent(
          milestone >= 50 ? "video_demo_watched" : "video_demo_progress",
          { progress_percent: milestone },
        );
      }}
    />
  );
}
