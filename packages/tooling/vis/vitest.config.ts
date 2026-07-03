import { getVitestConfig } from "../../../tools/get-vitest-config";

const config = getVitestConfig({
    test: {
        // The `vis run`/staged integration tests spawn the CLI -> task-runner,
        // which probes the package manager via `npm config get` (capped at 5s)
        // and then executes real tasks. On Windows that chain routinely exceeds
        // Vitest's default 5s timeout, and the late teardown then races the
        // still-running child (EBUSY on rmdir of the temp workspace). Give the
        // integration suites room; fast unit tests never approach this.
        testTimeout: 30_000,
    },
});

export default config;
