import { defineConfig } from "vitest/config";

// Live tests against real services: `docker compose -f docker-compose.live.yml up -d --wait`,
// then `LIVE_TESTS=1 pnpm run test:live`. Without LIVE_TESTS=1 every suite is skipped.
export default defineConfig({
    test: {
        environment: "node",
        include: ["__tests__/live/**/*.live.test.ts"],
        // Real round trips (and 5 MiB S3 parts) take longer than the in-memory fakes.
        testTimeout: 60_000,
    },
});
