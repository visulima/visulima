import { getVitestConfig } from "../../../tools/get-vitest-config";

const config = getVitestConfig({
    test: {
        // `detectScriptShell()` shells out to `npm config get script-shell`,
        // capped at its own 5s timeout. On Windows CI that one-time probe
        // routinely approaches 5s and collides with Vitest's default 5s test
        // timeout — the first `runConcurrently`/`detectScriptShell` call then
        // times out and its still-pending promise bleeds into the next test
        // (surfacing as a spurious assertion-count mismatch). Give the probe
        // headroom; the result is cached, so only the first call pays it.
        testTimeout: 15_000,
    },
});

export default config;
