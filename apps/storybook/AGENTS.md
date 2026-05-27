# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

Storybook 8 instance that aggregates component stories from across the monorepo. Uses `@storybook/react-vite` builder.

## Commands

```bash
pnpm dev    # Start storybook dev server
pnpm build  # Build static storybook
```

## Architecture

### Story Discovery

Stories are **not** in this directory. They live co-located with their packages:

```text
packages/<category>/<name>/__stories__/*.stories.tsx
```

Storybook discovers them via the glob pattern in `.storybook/main.ts`:

```text
../../packages/**/**/__stories__/**/*.stories.@(js|jsx|ts|tsx|mdx)
```

### Configuration

- `.storybook/main.ts` — framework config, addon list, story globs
- `.storybook/preview.ts` — global decorators, theme setup

### Addons

- essentials (controls, actions, docs, viewport)
- interactions (play functions)
- a11y (accessibility auditing)
- themes (light/dark via class toggle, default: light)
- links, docs

### Decorators

- `withConsole` — pipes console output to Storybook panel
- `withThemeByClassName` — toggles `"dark"` class for dark mode
- `autodocs: "tag"` — auto-generates docs from JSDoc

### Adding Stories

Create `__stories__/` directory in a package and add `*.stories.tsx` files. They'll be picked up automatically.
