# @visulima/vite-plugin-next-error-overlay

Vite error overlay styled after the redesigned Next.js 15.2 error overlay.

- Disables Vite's default overlay and renders a custom UI
- Shows error message, code frame, and lets you open in editor
- Captures `vite:error`, runtime `error`, and `unhandledrejection`

## Install

```bash
pnpm add -D @visulima/vite-plugin-next-error-overlay
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import nextOverlay from '@visulima/vite-plugin-next-error-overlay'

export default defineConfig({
  plugins: [nextOverlay(), react()]
})
```

Options:

- `theme`: "dark" | "light" (default: "dark")

## Notes

This aims to approximate Next.js 15.2 overlay layout and behavior based on release notes. It does not replicate internal stack frame collapsing or owner stack introspection.