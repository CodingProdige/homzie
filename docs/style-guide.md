# Homzie Style Guide

Homzie uses a cinematic, media-first brand system inspired by vertical property video, premium homes, and creator-led discovery.

## Brand Palette

Use these tokens from `src/app/globals.css` instead of hard-coded colors.

| Token | Hex | Usage |
| --- | --- | --- |
| `--homzie-purple` | `#7B5CFF` | Primary actions, selected states, active navigation |
| `--homzie-pink` | `#FF4DB8` | Highlights, creator/social actions, accent moments |
| `--homzie-electric` | `#4E2AFF` | Brand depth, gradients, focus emphasis |
| `--homzie-midnight` | `#1A1A2E` | Cards and panels on dark surfaces |
| `--homzie-black` | `#0D0D14` | Main dark app background |
| `--homzie-white` | `#FFFFFF` | Text and elevated surfaces |

The core brand gradient is:

```css
linear-gradient(135deg, #4E2AFF 0%, #7B5CFF 48%, #FF4DB8 100%)
```

Use it sparingly for brand marks, hero accents, primary promotional moments, and selected feed controls. Standard app controls should rely on the semantic shadcn tokens.

## Typography

Primary font:

```text
Poppins
```

Weights:

- `700` for brand headlines, page titles, and major calls to action.
- `500` for navigation, buttons, cards, and labels.
- `400` for body copy and supporting text.

The app loads Poppins through `next/font/google` in `src/app/layout.tsx` and exposes it as `--font-poppins`.

## UI Direction

Public discovery surfaces should feel premium, dark, visual, and media-led. Dashboard and admin surfaces should stay calmer and more operational, but still use the same brand tokens.

Prefer:

- Dark immersive surfaces for video/reel experiences.
- Purple primary actions.
- Pink accents for saved/follow/social engagement.
- Midnight cards on dark backgrounds.
- White text on dark discovery screens.
- shadcn/ui primitives as the base for reusable controls.

Avoid:

- Hard-coded one-off purples.
- Gradients on every card or button.
- Ecommerce visual patterns.
- Decorative color systems outside the Homzie palette.

## Tailwind Token Usage

The palette is exposed to Tailwind through `@theme inline`:

```text
bg-brand-purple
text-brand-pink
border-brand-midnight
bg-brand-black
text-brand-white
```

Semantic shadcn tokens are also mapped to the brand:

```text
bg-primary
text-primary-foreground
bg-card
text-card-foreground
border-border
ring-ring
```

Use semantic tokens for components. Use `brand-*` tokens when the design explicitly needs brand expression.
