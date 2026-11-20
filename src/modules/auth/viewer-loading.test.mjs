import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const typescript = require("typescript");
const projectRoot = new URL("../../../", import.meta.url);
const signedInViewer = {
  avatarUrl: "/media/avatars/current-viewer.webp",
  hasAgencyWorkspace: true,
  name: "Current Viewer",
  role: "admin",
  username: "current.viewer",
};
const loadingRoutes = [
  ["profile", "src/app/users/[username]/loading.tsx", true],
  ["analytics", "src/app/users/[username]/analytics/loading.tsx", true],
  ["reels", "src/app/users/[username]/reels/loading.tsx", false],
];

function EmptyComponent() {
  return null;
}

function NavigationLink({ children, href, ...props }) {
  delete props.prefetch;
  return React.createElement("a", { ...props, href }, children);
}

function NavigationImage(props) {
  const imageProps = { ...props };
  delete imageProps.priority;
  return React.createElement("img", imageProps);
}

function loadLoadingComponent(filename, getCurrentViewerChrome) {
  const cache = new Map();
  const localModules = {
    "@/components/global-header": "src/components/global-header.tsx",
    "@/components/global-footer": "src/components/global-footer.tsx",
    "@/components/ui/button": "src/components/ui/button.tsx",
    "@/lib/utils": "src/lib/utils.ts",
    "@/media/paths": "src/media/paths.ts",
  };
  const decorativeModules = {
    "@/components/buyer-activity-signal": ["BuyerActivityLivePill", "BuyerActivitySignalIcon"],
    "@/components/country-preference-selector": ["CountryPreferenceSelector"],
    "@/components/global-user-search": ["GlobalUserSearchTrigger"],
    "@/components/homzie-logo": ["HomzieLogo"],
    "@/modules/auth/components/theme-toggle": ["ThemeToggle"],
    "@/modules/currency/currency-selector": ["CurrencySelector"],
    "@/modules/events/components/event-count-badge": ["EventCountBadge"],
    "@/modules/listings/components/listing-buyer-activity-count-badge": ["ListingBuyerActivityCountBadge"],
    "@/modules/messages/components/message-count-badge": ["MessageCountBadge"],
    "@/modules/messages/components/message-realtime-presence": ["MessageRealtimePresence"],
    "@/modules/notifications/components/activity-count-badge": ["ActivityCountBadge"],
    "@/modules/pwa/components/pwa-install": ["InstallHomzieButton"],
  };
  const allowedDependencies = new Set([
    "react", "react/jsx-runtime", "lucide-react", "clsx", "tailwind-merge",
    "class-variance-authority", "@radix-ui/react-slot", "@radix-ui/react-dialog",
    "@radix-ui/react-dropdown-menu",
  ]);

  function isolatedRequire(name) {
    if (name === "@/modules/auth/viewer") return { getCurrentViewerChrome };
    if (name === "next/navigation") return { usePathname: () => "/users/current.viewer" };
    if (name === "next/link") return NavigationLink;
    if (name === "next/image") return NavigationImage;
    if (localModules[name]) return load(localModules[name]);
    if (decorativeModules[name]) {
      return Object.fromEntries(decorativeModules[name].map((exportName) => [exportName, EmptyComponent]));
    }
    if (allowedDependencies.has(name)) return require(name);
    throw new Error("Unexpected loading UI test import: " + name);
  }

  function load(relativePath) {
    if (cache.has(relativePath)) return cache.get(relativePath).exports;
    const loaded = { exports: {} };
    cache.set(relativePath, loaded);
    const compiled = typescript.transpileModule(
      readFileSync(new URL(relativePath, projectRoot), "utf8"),
      {
        compilerOptions: {
          target: typescript.ScriptTarget.ES2020,
          module: typescript.ModuleKind.CommonJS,
          jsx: typescript.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      },
    ).outputText;
    new Function("require", "module", "exports", compiled)(
      isolatedRequire, loaded, loaded.exports,
    );
    return loaded.exports;
  }

  return load(filename).default;
}

function headerMarkup(html) {
  const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0];
  assert.ok(header, "Loading UI must include the real global header");
  return header;
}

for (const [label, filename, hasFooter] of loadingRoutes) {
  test(`${label} loading waits for verified viewer data instead of showing guest navigation`, async () => {
    let resolveViewer;
    const viewerPromise = new Promise((resolve) => { resolveViewer = resolve; });
    const Loading = loadLoadingComponent(filename, () => viewerPromise);
    const output = Loading();
    let settled = false;
    Promise.resolve(output).then(() => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, false, "Do not render signed-out navigation before viewer resolution");

    resolveViewer(signedInViewer);
    const html = renderToStaticMarkup(await output);
    const header = headerMarkup(html);
    assert.match(header, /href="\/users\/current\.viewer"/);
    assert.match(header, /src="\/media\/avatars\/current-viewer\.webp"/);
    assert.match(header, /alt="Current Viewer"/);
    assert.doesNotMatch(header, /Sign in/);

    if (hasFooter) {
      const footer = html.match(/<footer\b[\s\S]*?<\/footer>/)?.[0];
      assert.ok(footer);
      assert.match(footer, /href="\/users\/current\.viewer"/);
      assert.match(footer, /href="\/admin"/);
    }
  });

  test(`${label} loading uses the current request's signed-out state after a signed-in render`, async () => {
    let viewer = signedInViewer;
    const Loading = loadLoadingComponent(filename, async () => viewer);
    const signedInHeader = headerMarkup(renderToStaticMarkup(await Loading()));
    assert.match(signedInHeader, /href="\/users\/current\.viewer"/);

    viewer = {};
    const html = renderToStaticMarkup(await Loading());
    const signedOutHeader = headerMarkup(html);
    assert.match(signedOutHeader, /href="\/sign-in"/);
    assert.match(signedOutHeader, /Sign in/);
    assert.doesNotMatch(signedOutHeader, /current\.viewer|Current Viewer|current-viewer\.webp/);
    if (hasFooter) {
      const footer = html.match(/<footer\b[\s\S]*?<\/footer>/)?.[0];
      assert.doesNotMatch(footer, /href="\/admin"|href="\/users\/current\.viewer"/);
    }
  });
}
