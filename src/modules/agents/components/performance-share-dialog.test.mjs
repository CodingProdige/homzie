import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const typescript = require("typescript");
const canonicalUrl = "https://homzie.example.test/users/demo.agent/performance?period=90d&source=meeting";
const profile = {
  username: "demo.agent",
  name: "Demo Agent & Team",
  performanceUrl: canonicalUrl,
};

function TransparentDialog({ children }) {
  return React.createElement(React.Fragment, null, children);
}

// The real closed Radix portal omits its content during SSR. Only the link
// assertion swaps Radix wrappers so the actual component's anchors are visible.
const transparentDialog = Object.fromEntries(
  ["Root", "Trigger", "Portal", "Overlay", "Content", "Title", "Description", "Close"]
    .map((name) => [name, TransparentDialog]),
);

function loadDialog({ showPortal = false } = {}) {
  const filename = new URL("./performance-share-dialog.tsx", import.meta.url);
  const compiled = typescript.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      target: typescript.ScriptTarget.ES2020,
      module: typescript.ModuleKind.CommonJS,
      jsx: typescript.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const loaded = { exports: {} };
  const isolatedRequire = (name) => {
    if (name === "@/components/ui/button") {
      return {
        Button: ({ children, ...props }) => React.createElement("button", props, children),
      };
    }
    if (name === "@radix-ui/react-dialog") {
      return showPortal ? transparentDialog : require(name);
    }
    if (["react", "react/jsx-runtime", "lucide-react"].includes(name)) return require(name);
    throw new Error("Unexpected share-dialog test import: " + name);
  };

  // Browser globals are deliberately not supplied. A client component still
  // needs to render its initial HTML on the server without window or document.
  new Function("require", "module", "exports", compiled)(
    isolatedRequire, loaded, loaded.exports,
  );
  return loaded.exports.PerformanceShareDialog;
}

test("owner performance share trigger renders on the server without browser globals", () => {
  assert.equal(typeof globalThis.window, "undefined");
  assert.equal(typeof globalThis.document, "undefined");
  const PerformanceShareDialog = loadDialog();
  const html = renderToStaticMarkup(React.createElement(PerformanceShareDialog, { ...profile, isOwner: true }));

  assert.match(html, /Share my performance/);
  assert.match(html, /<button\b/);
  assert.match(html, /aria-haspopup="dialog"/);
});

test("visitor performance share trigger renders on the server", () => {
  const PerformanceShareDialog = loadDialog();
  const html = renderToStaticMarkup(React.createElement(PerformanceShareDialog, profile));

  assert.match(html, /Share this performance/);
  assert.doesNotMatch(html, /Share my performance/);
});

test("all share targets encode the canonical server-supplied performance URL", () => {
  const PerformanceShareDialog = loadDialog({ showPortal: true });
  const html = renderToStaticMarkup(React.createElement(PerformanceShareDialog, profile));
  const hrefs = [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)]
    .map((match) => match[1].replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'"));
  const shareText = `View ${profile.name}'s Homzie Agent performance`;

  assert.deepEqual(hrefs, [
    `https://wa.me/?text=${encodeURIComponent(`${shareText} ${canonicalUrl}`)}`,
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}`,
    `sms:?&body=${encodeURIComponent(`${shareText} ${canonicalUrl}`)}`,
    `mailto:?subject=${encodeURIComponent("Homzie performance")}&body=${encodeURIComponent(`${shareText} ${canonicalUrl}`)}`,
  ]);
  assert.match(html, /Copy link/);
  assert.match(html, /Share with device/);
});
