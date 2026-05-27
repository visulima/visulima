# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

The Visulima website — built with **TanStack Start** (React meta-framework on Vite) with file-based routing via TanStack Router. Deploys to Netlify with SSR.

## Commands

```bash
pnpm dev      # Dev server (runs generate-packages + copy-docs first)
pnpm build    # Production build (runs generate-packages + copy-docs + fetch-stats + vite build)
pnpm serve    # Preview production build
```

## Architecture

### Routing

File-based routing via TanStack Router. Route files live in `src/routes/`. The route tree is auto-generated at `src/routeTree.gen.ts` — do not edit it manually.

### Content & Documentation

Uses **Fumadocs** with MDX. Content sources configured in `source.config.ts`:

- `src/content/docs/` — package documentation (copied from packages by `scripts/copy-package-docs.js`)
- `src/content/docs-static/` — static documentation pages
- `src/content/articles/` — blog articles
- `src/content/changelogs/` — changelog entries

### Build-time Data Generation

Three scripts run before Vite build (in order):

1. **`scripts/generate-packages.js`** — discovers workspace packages via `project.json` tags + `package.json` metadata, merges with `src/data/packages-metadata.json`, outputs `src/data/packages.ts`
2. **`scripts/copy-package-docs.js`** — copies docs from each package into `src/content/docs/`
3. **`scripts/fetch-stats.js`** — fetches npm download stats into `src/data/stats.json`

### Adding a Package to the Website

1. Add `category:<slug>` tag to the package's `project.json` (see root AGENTS.md for valid slugs)
2. Optionally add `displayName` and `features` to `src/data/packages-metadata.json`
3. The package appears on next build

### Styling

- **Tailwind CSS v4** with `@tailwindcss/vite` plugin
- Tailwind v4 `@theme`/`@variant` syntax in `src/app.css`
- **shadcn/ui** components (New York style) — config in `components.json`
- Components use **CVA** (class-variance-authority) for variant styling
- Geist Sans/Mono fonts loaded via `unplugin-fonts`

### Component Organization

- `src/components/ui/` — shadcn/ui primitives
- `src/components/sections/` — page layout sections (navbar, footer, hero)
- `src/components/seo/` — meta tags and structured data
- `src/pages/` — page-level components used by routes

### Dev-only Tools

Conditionally loaded in development:

- `@visulima/dev-toolbar` — a11y auditing, performance monitoring, inspector
- `@visulima/vite-overlay` — enhanced error overlay

### Special Build Features

- Image optimization via `vite-imagetools`
- SVG → React components via `vite-plugin-svgr`
- Babel React Compiler plugin for production optimization
- `llms.txt` / `llms-full.txt` generation for LLM context
- OG image generation at `/api/og`
