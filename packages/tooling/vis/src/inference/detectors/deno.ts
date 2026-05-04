import type { DetectedTargets, Detector } from "../types";

export const denoDetector: Detector = {
    configFiles: ["deno.json", "deno.jsonc"],
    // No `fallbackDependency`: Deno is a runtime, not an npm package.
    detect: ({ matchedConfigs }) => {
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;
        const sharedInputs = ["{projectRoot}/src/**/*", "{projectRoot}/__tests__/**/*", ...(configRef ? [configRef] : [])];

        const targets: DetectedTargets["targets"] = {
            // `lint` and `test` collide with eslint/biome/oxlint and
            // vitest/jest/bun respectively — registered last in the
            // detector list so the npm-native tooling wins. `fmt` and
            // `check` use names unique to deno's CLI vocabulary.
            check: {
                command: "deno check **/*.ts",
                description: "deno check (inferred)",
                inputs: sharedInputs,
                outputs: [],
                type: "build",
            },
            fmt: {
                command: "deno fmt",
                description: "deno fmt (inferred)",
            },
            lint: {
                command: "deno lint",
                description: "deno lint (inferred)",
                inputs: sharedInputs,
                outputs: [],
                type: "build",
            },
            test: {
                command: "deno test",
                description: "deno test (inferred)",
                inputs: sharedInputs,
                outputs: [],
                type: "test",
            },
        };

        return { targets };
    },
    name: "deno",
};
