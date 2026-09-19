import { getVitestConfig } from "../../../tools/get-vitest-config";

const config = getVitestConfig({
    test: {
        // The `vis run`/staged integration tests spawn the CLI -> task-runner,
        // which probes the package manager via `npm config get` (capped at 5s)
        // and then executes real tasks. On Windows that chain routinely exceeds
        // Vitest's default 5s timeout, and the late teardown then races the
        // still-running child (EBUSY on rmdir of the temp workspace). Give the
        // integration suites room; fast unit tests never approach this.
        //
        // 30s held while only vis-affected projects ran. A lockfile change makes
        // every project affected, and the release suites then time out (with the
        // same EBUSY teardown behind them) against a Windows runner carrying the
        // whole workspace at once. 60s covers that; it is still a bound, not a wait.
        testTimeout: 60_000,
    },
});

export default config;
