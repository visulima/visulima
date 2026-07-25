import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { findPackageJsonSync } from "@visulima/package";

import pkg from "../../package.json";

// The version literal inlined by the bundler. CI builds every package *before*
// semantic-release bumps the manifests, so in a published tarball this value is
// always one release behind (visulima/visulima#741) — it is only a last-resort
// fallback for exotic layouts where the manifest can't be located at runtime.
const BUILD_TIME_VERSION = pkg.version;

const PACKAGE_NAME = "@visulima/vis";

let cachedVersion: string | undefined;

/**
 * Resolve vis's own version from the `package.json` that actually shipped,
 * rather than from a literal frozen at build time.
 *
 * `VIS_VERSION` wins when set — `injectVersion()` exports it so child processes
 * spawned by vis report the same version as their parent.
 * @returns The resolved semver string.
 */
const getPackageVersion = (): string => {
    if (cachedVersion !== undefined) {
        return cachedVersion;
    }

    const fromEnvironment = process.env["VIS_VERSION"];

    if (fromEnvironment) {
        cachedVersion = fromEnvironment;

        return cachedVersion;
    }

    try {
        // Walk up from this module's location, not from `process.cwd()` — the
        // nearest manifest above `dist/**` is vis's own, at whatever depth the
        // bundler happened to place the chunk.
        const { packageJson } = findPackageJsonSync(dirname(fileURLToPath(import.meta.url)), { json5: false, yaml: false });

        if (packageJson.name === PACKAGE_NAME && typeof packageJson.version === "string") {
            cachedVersion = packageJson.version;

            return cachedVersion;
        }
    } catch {
        // No manifest found (unusual bundling, a single-file build) — fall through.
    }

    cachedVersion = BUILD_TIME_VERSION;

    return cachedVersion;
};

export default getPackageVersion;
