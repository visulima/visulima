import codspeedPlugin from "@codspeed/vitest-plugin";

import { getVitestConfig } from "../../../tools/get-vitest-config";

// Bench config = the package's normal vitest config + CodSpeed instrumentation.
// CodSpeed's plugin is a no-op outside the CodSpeedHQ runner, so this is safe to
// run locally (`pnpm test:bench`) and in CI alike. Wired into the pipeline via
// the inferred `vis:test:bench` nx target, which the .github/workflows/codspeed.yml
// matrix discovers and runs under the CodSpeed action.
//
// Kept as a SEPARATE config (rather than a `<pkg>-bench` sub-package like
// tui-bench/task-runner-bench) on purpose: vis's benches import `#native`
// directly and via `src/`, so they must stay in the vis package scope for the
// `#native` subpath import to resolve. A `__bench__/package.json` would shift
// that scope and break it.
export default getVitestConfig({
    plugins: [codspeedPlugin()],
    test: {
        testTimeout: 30_000,
    },
});
