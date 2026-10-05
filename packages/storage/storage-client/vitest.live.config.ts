import { defineConfig } from "vitest/config";

// Live tests of the client against the real @visulima/storage handlers, over the services of
// packages/storage/storage/docker-compose.live.yml: `docker compose -f ../storage/docker-compose.live.yml
// up -d --wait`, then `LIVE_TESTS=1 pnpm run test:live`. Without LIVE_TESTS=1 every suite is skipped.
export default defineConfig({
    test: {
        environment: "node",
        hookTimeout: 60_000,
        include: ["__tests__/live/**/*.live.test.ts"],
        // Real round trips (and 5 MiB S3 parts) take longer than the mocked fetch and XHR.
        testTimeout: 60_000,
    },
});
