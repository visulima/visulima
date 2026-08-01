import { createRequire } from "node:module";

import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";
import type { Plugin } from "rollup";

/**
 * `requireCJS.builtinNodeModules` rewrites every `import … from "node:*"` into a module-scope
 * `__cjs_getBuiltinModule("node:*")` call, and prepends an interop preamble that resolves the
 * builtin through `process.getBuiltinModule` with a `createRequire` fallback for Node < 20.16 /
 * < 22.3. That preamble is what makes the emitted chunks contradict this package's
 * `"sideEffects": false`:
 *
 * - the destructuring is a module-scope *call*, so a bundler that assumes side effects keeps the
 *   whole chunk alive even when none of its exports are used;
 * - the `createRequire` fallback needs a static `import { createRequire } from "node:module"`,
 *   which then rides along into every consumer bundle — including ones targeting runtimes that
 *   have no Node core at all, where a static `node:module` import fails at *import* time.
 *
 * A consumer importing only `serializeError` from `./error` therefore inherits `node:module`
 * purely because `renderError` and `getErrorCauses` sit in the same barrel.
 *
 * Both halves of that are avoidable here:
 *
 * 1. This package's `engines.node` is `^22.14.0 || >=24.10.0`, so `process.getBuiltinModule` is
 *    always present and the `createRequire` fallback is dead code. Dropping it removes the only
 *    static `node:module` import from the output.
 * 2. Resolving a Node core module has no observable side effect, so the lookup can carry a
 *    `@__PURE__` annotation. With it, a consumer's bundler drops the destructuring — and then the
 *    rest of the preamble — as soon as the imported binding is unused.
 *
 * This has to be fixed here rather than in a consumer's build. Rollup honours our
 * `"sideEffects": false` and drops the unused chunks outright — but only while the consumer
 * registers no build plugin of its own: with one present, packem falls back to
 * `treeshake.moduleSideEffects: true` for the whole graph and the chunks come back. Whether a
 * consumer's bundle stays free of `node:module` must not depend on that.
 *
 * ## What this narrows
 *
 * `engines.node` only constrains Node. Point 1 also drops the fallback for *non-Node* runtimes
 * that report a `process.versions.node` while implementing no `process.getBuiltinModule` — older
 * Deno and Bun releases both do, and they used to land on `createRequire`. Restoring the fallback
 * is not an option: its static `import { createRequire } from "node:module"` is the very thing
 * that has to go. Those runtimes are therefore no longer supported, and the replacement helper
 * below says so explicitly instead of letting them fail with an opaque
 * `TypeError: __cjs_getProcess.getBuiltinModule is not a function`.
 *
 * ## What keeps this honest
 *
 * Every rewrite below asserts the packem fragment it expects and throws when it is missing, so a
 * preamble reshuffle surfaces as a build failure rather than silently reinstating `node:module`.
 * Two paths cannot throw — a chunk with no interop at all is the normal case, and a chunk whose
 * `__cjs_require` call count is unexpected may legitimately have a second CJS dependency — so
 * those warn instead, and the plugin's `generateBundle` hook warns once per build if *no* chunk
 * matched at all (which is what a helper rename upstream would look like).
 *
 * `__tests__/integration/dist-node-interop.test.ts` guards the output shape directly and fails
 * hard on any of those warnings' underlying causes;
 * `packages/error-debugging/pail/__tests__/integration/edge-reporter-dist.test.ts` guards the
 * end-to-end effect, on a built edge entry that pulls `serializeError` out of this package.
 */

/** Named in every diagnostic below: the preamble shape is version-specific, so say which version. */
const PACKEM_VERSION: string = (createRequire(import.meta.url)("@visulima/packem/package.json") as { version: string }).version;

/** Static import that only exists to back the `createRequire` fallback. */
const CREATE_REQUIRE_IMPORT_REGEX = /^import \{ createRequire as __cjs_createRequire \} from "node:module";\n+/mu;

/** The memoised `createRequire` wrapper the fallback calls. */
const CJS_REQUIRE_HELPER_REGEX = /^let __cjs_cachedRequire;\nconst __cjs_require = \(id\) => \{\n(?:.*\n)*?\};\n+/mu;

/** The builtin resolver, whose Node-version branch and fallback are both dead under our engines. */
const GET_BUILTIN_MODULE_HELPER_REGEX = /^const __cjs_getBuiltinModule = \(module\) => \{\n(?:.*\n)*?\};\n/mu;

/**
 * Replacement for the helper above. The shape matters: when a consumer inlines one of our chunks
 * and its own `requireCJS` pass prepends a second preamble, packem de-duplicates the two by
 * matching `const __cjs_getBuiltinModule = (…) => { … };` textually. An expression-bodied arrow
 * would slip past that and leave the identifier declared twice in the consumer's chunk, so keep the
 * block body — and keep it free of any `};` before the closing one, which is where that match ends.
 *
 * The capability check is what replaces packem's `versions.node` branch: without the
 * `createRequire` fallback there is nothing to degrade to, so a runtime that cannot satisfy the
 * lookup should say which capability it is missing rather than throw `… is not a function` from
 * somewhere inside a bundled chunk.
 */
const GET_BUILTIN_MODULE_HELPER = `const __cjs_getBuiltinModule = (module) => {
    if (typeof __cjs_getProcess?.getBuiltinModule !== "function") {
        throw new Error("[@visulima/error] Cannot load " + module + ": this runtime implements no process.getBuiltinModule(). Requires Node >= 20.16 / >= 22.3, or another runtime providing process.getBuiltinModule().");
    }
    return __cjs_getProcess.getBuiltinModule(module);
};
`;

/** Call sites of the resolver that are not already annotated. */
const BUILTIN_LOOKUP_REGEX = /(?<!\/\* @__PURE__ \*\/ )__cjs_getBuiltinModule\(/gu;

/** Emitted when a rewrite is skipped, so the packem upgrade that caused it is identifiable. */
const shapeChanged = (detail: string): string =>
    `${detail} Verified against @visulima/packem@${PACKEM_VERSION}; the CJS-interop preamble shape appears to have changed — update packem.config.ts.`;

const dropDeadNodeInterop = (code: string, chunkName: string, warn: (message: string) => void): string => {
    let next = code;

    // `__cjs_require` is also the generic CJS-require helper. This package has no runtime
    // dependencies, so its only caller is the builtin fallback below; if that ever stops being
    // true, leave the fallback in place and settle for the annotation.
    const requireCallSites = (code.match(/__cjs_require\(/gu) ?? []).length;

    if (requireCallSites === 1) {
        for (const [what, pattern] of [
            ["the `node:module` import", CREATE_REQUIRE_IMPORT_REGEX],
            ["the `__cjs_require` helper", CJS_REQUIRE_HELPER_REGEX],
        ] as const) {
            if (!pattern.test(next)) {
                throw new Error(shapeChanged(`Could not find ${what} in the CJS-interop preamble of "${chunkName}".`));
            }

            next = next.replace(pattern, "");
        }

        if (!GET_BUILTIN_MODULE_HELPER_REGEX.test(next)) {
            throw new Error(shapeChanged(`Could not find the \`__cjs_getBuiltinModule\` helper in "${chunkName}".`));
        }

        next = next.replace(GET_BUILTIN_MODULE_HELPER_REGEX, GET_BUILTIN_MODULE_HELPER);
    } else {
        // Zero means the fallback stopped calling `__cjs_require`; two or more means a real CJS
        // dependency shares the helper. Either way the removal above is unsafe, so only the
        // annotation applies — and `node:module` stays in the chunk. Not fatal (a stray CJS dep
        // must not break the build outright), but never silent: `dist-node-interop.test.ts` turns
        // it into a hard CI failure.
        warn(
            shapeChanged(
                `Expected exactly one \`__cjs_require(\` call site — the dead builtin fallback — in "${chunkName}", found ${String(requireCallSites)}. Left the \`createRequire\` fallback and its \`node:module\` import in place.`,
            ),
        );
    }

    return next.replaceAll(BUILTIN_LOOKUP_REGEX, "/* @__PURE__ */ __cjs_getBuiltinModule(");
};

/**
 * A chunk without `__cjs_getBuiltinModule(` is the overwhelmingly common case, so that check
 * cannot throw. But if it short-circuits *every* chunk of a build, the helper was renamed upstream
 * and this whole plugin quietly became a no-op — which is exactly the failure it exists to prevent.
 */
const createPruneNodeBuiltinInterop = (): Plugin => {
    let chunksRewritten = 0;

    return {
        generateBundle: {
            handler() {
                if (chunksRewritten === 0) {
                    this.warn(
                        shapeChanged(
                            "No chunk contained a `__cjs_getBuiltinModule(` call, so the CJS-interop preamble was never rewritten and the build may ship a `createRequire` fallback.",
                        ),
                    );
                }
            },
            order: "post",
        },
        name: "error:prune-node-builtin-interop",
        renderChunk: {
            handler(code, chunk) {
                if (!code.includes("__cjs_getBuiltinModule(")) {
                    return null;
                }

                chunksRewritten += 1;

                return {
                    code: dropDeadNodeInterop(code, chunk.fileName, (message) => {
                        this.warn(message);
                    }),
                    map: null,
                };
            },
            // `packem:plugin-require-cjs` emits the preamble from its own `renderChunk` hook, which
            // runs in the default ("pre") slot.
            order: "post",
        },
    };
};

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    runtime: "node",
    rollup: {
        dts: {
            oxc: true,
        },
        license: {
            path: "./LICENSE.md",
        },
        plugins: [
            {
                plugin: createPruneNodeBuiltinInterop(),
                type: "build",
            },
        ],
        requireCJS: {
            builtinNodeModules: true,
        },
    },
    transformer,
    //
}) as BuildConfig;
