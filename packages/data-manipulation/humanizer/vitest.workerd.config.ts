import { getWorkerdVitestConfig } from "../../../tools/get-workerd-vitest-config";

/**
 * The unit suite is runtime-independent, so it is the single definition of this
 * package's behaviour and runs in both pools rather than being copied into
 * `__tests__/workerd/`.
 *
 * `unit/language/languages.test.ts` is the one exception: it enumerates
 * `__fixtures__/duration` with `node:fs` and streams the CSVs, and the workers
 * pool has no view of the real filesystem. It stays Node-only.
 */
const config = getWorkerdVitestConfig({
    test: {
        exclude: ["__tests__/unit/language/languages.test.ts"],
        include: ["__tests__/unit/**/*.test.ts", "__tests__/workerd/**/*.test.ts"],
    },
});

export default config;
