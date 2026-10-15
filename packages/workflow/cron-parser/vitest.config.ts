import { getVitestConfig } from "../../../tools/get-vitest-config";

// The suite runs once per zone backend: `Intl` (what Node and Bun use today) and `Temporal`
// (what runtimes with native Temporal use). Both must agree on every DST edge.
const config = getVitestConfig({
    test: {
        env: { TZ: "UTC" },
        projects: [
            { extends: true, test: { name: "intl" } },
            { extends: true, test: { name: "temporal", setupFiles: ["./__tests__/_setup/temporal.ts"] } },
        ],
    },
});

export default config;
