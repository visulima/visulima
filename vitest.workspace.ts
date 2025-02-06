import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  "./packages/string/vitest.config.ts",
  "./packages/tsconfig/vitest.config.ts",
  "./packages/ansi/vitest.config.ts",
  "./packages/boxen/vitest.config.ts",
  "./packages/fs/vitest.config.ts",
  "./packages/package/vitest.config.ts",
  "./packages/crud/vitest.config.ts",
  "./packages/object/vitest.config.ts",
  "./packages/humanizer/vitest.config.ts",
  "./packages/connect/vitest.config.ts",
  "./packages/pail/vitest.config.ts",
  "./packages/prisma-dmmf-transformer/vitest.config.ts",
  "./packages/fmt/vitest.config.ts",
  "./packages/colorize/vitest.config.ts",
  "./packages/find-cache-dir/vitest.config.ts",
  "./packages/api-platform/vitest.config.ts",
  "./packages/cerebro/vitest.config.ts",
  "./packages/pagination/vitest.config.ts",
  "./packages/error/vitest.config.ts",
  "./packages/redact/vitest.config.ts",
  "./packages/inspector/vitest.config.ts",
  "./packages/deep-clone/vitest.config.ts",
  "./packages/jsdoc-open-api/vitest.config.ts",
  "./packages/is-ansi-color-supported/vitest.config.ts",
  "./packages/source-map/vitest.config.ts",
  "./packages/health-check/vitest.config.ts",
  "./packages/path/vitest.config.ts",
  "./apps/docs/vitest.config.ts"
])
