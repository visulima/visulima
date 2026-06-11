import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_WALK_UP_DEPTH = 12;

/**
 * Loads the napi-rs-generated, platform-detecting root `index.js` of this
 * native package and returns its exports.
 *
 * The generated loader lives next to `package.json` at the package root (one
 * level above `dist/`). It already does the hard part: selecting the right
 * binary for the host platform and libc, trying the published
 * `binding` optionalDependencies first and falling back to a locally-built
 * `.node` addon at the root. The only thing the TypeScript side must do
 * reliably is find and load that file.
 *
 * Why not a fixed relative path such as `../index.js`? Bundlers such as packem
 * hoist shared modules into chunks at an unpredictable depth under `dist/`
 * (for example `dist/packem_shared/`), so `../index.js` can resolve to the
 * bundled public API, which re-exports the TS wrappers rather than the raw
 * native functions, and the binding validation then fails. Walking up to the
 * first directory that contains a `package.json` finds the true package root
 * regardless of nesting: `dist/` has no `package.json`, so the walk never stops
 * short.
 *
 * `require()` (not dynamic `import()`) keeps this synchronous. The generated
 * `index.js` is ESM, but Node 22+ supports `require()` of ESM without
 * top-level await, which the napi output never emits.
 * @param importMetaUrl The caller's `import.meta.url`.
 * @returns The native binding's exports.
 */
const loadNativeRootBinding = (importMetaUrl: string): unknown => {
    const require = createRequire(importMetaUrl);
    const start = dirname(fileURLToPath(importMetaUrl));

    let directory = start;

    for (let depth = 0; depth < MAX_WALK_UP_DEPTH; depth += 1) {
        if (existsSync(join(directory, "package.json")) && existsSync(join(directory, "index.js"))) {
            // eslint-disable-next-line import/no-dynamic-require -- the path is the package-root index.js, resolved by walking up at runtime
            return require(join(directory, "index.js"));
        }

        const parent = dirname(directory);

        if (parent === directory) {
            break;
        }

        directory = parent;
    }

    // Fall back to the historical relative path — correct when this module is
    // emitted directly under dist/ without chunk hoisting.
    // eslint-disable-next-line import/no-dynamic-require -- computed fallback path to the package-root index.js
    return require(join(start, "..", "index.js"));
};

export default loadNativeRootBinding;
