/**
 * Feature-detected JS polyfills for `vis x` user scripts — the runtime
 * augmentation layer's polyfill tier. Strictly opt-in (launcher `--polyfill`,
 * surfaced as VIS_POLYFILL) and strictly feature-detected: a polyfill is only
 * installed onto `globalThis` when the native API is actually absent, so newer
 * runtimes that already ship the API are never touched.
 *
 * Scope is the user script run via `vis x` only — vis's own runtime is never
 * polyfilled. The polyfill packages are NOT vis dependencies: they're resolved
 * from the *user's* project (the cwd where `vis x` runs), which is where a script
 * needing them would declare them. If one isn't installed we warn and continue.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import { join } from "@visulima/path";

type PolyfillName = "temporal" | "urlpattern";

const ALL: PolyfillName[] = ["temporal", "urlpattern"];

/** Parse the VIS_POLYFILL spec: "all", or a comma list like "temporal,urlpattern". */
const parseSpec = (spec: string): PolyfillName[] => {
    const trimmed = spec.trim().toLowerCase();

    if (trimmed === "" || trimmed === "all" || trimmed === "1" || trimmed === "true") {
        return ALL;
    }

    return trimmed
        .split(",")
        .map((part) => part.trim())
        .filter((part): part is PolyfillName => (ALL as string[]).includes(part));
};

/**
 * Import a package resolved from the user's project (cwd), not vis's own tree.
 * Returns the module namespace, or undefined if the package isn't installed there.
 */
const importFromCwd = async (packageName: string, cwd: string): Promise<Record<string, unknown> | undefined> => {
    try {
        // createRequire anchored in the cwd resolves the user project's node_modules.
        const requireFromCwd = createRequire(join(cwd, "__vis_polyfill_resolver__.js"));
        const resolved = requireFromCwd.resolve(packageName);

        return (await import(pathToFileURL(resolved).href)) as Record<string, unknown>;
    } catch {
        return undefined;
    }
};

/** Install `Temporal` from the `@js-temporal/polyfill` package if the runtime lacks it. */
const installTemporal = async (cwd: string): Promise<void> => {
    if ((globalThis as Record<string, unknown>)["Temporal"] !== undefined) {
        return;
    }

    const loaded = await importFromCwd("@js-temporal/polyfill", cwd);

    if (loaded?.["Temporal"] === undefined) {
        process.stderr.write("vis: --polyfill temporal requested but @js-temporal/polyfill is not installed in this project.\n");
    } else {
        (globalThis as Record<string, unknown>)["Temporal"] = loaded["Temporal"];
    }
};

/** Install `URLPattern` from the `urlpattern-polyfill` package if the runtime lacks it. */
const installUrlPattern = async (cwd: string): Promise<void> => {
    if ((globalThis as Record<string, unknown>)["URLPattern"] !== undefined) {
        return;
    }

    const loaded = await importFromCwd("urlpattern-polyfill", cwd);

    if (loaded?.["URLPattern"] === undefined) {
        process.stderr.write("vis: --polyfill urlpattern requested but urlpattern-polyfill is not installed in this project.\n");
    } else {
        (globalThis as Record<string, unknown>)["URLPattern"] = loaded["URLPattern"];
    }
};

/**
 * Install the requested polyfills. `spec` is the VIS_POLYFILL value; packages are
 * resolved from `cwd`. Each is feature-detected; a missing package degrades to a
 * warning.
 */
export const installPolyfills = async (spec: string, cwd: string = process.cwd()): Promise<void> => {
    const requested = parseSpec(spec);

    await Promise.all(
        requested.map(async (name) => {
            await (name === "temporal" ? installTemporal(cwd) : installUrlPattern(cwd));
        }),
    );
};
