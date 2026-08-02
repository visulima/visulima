import process from "./process";

/** The Node core modules this package reaches for, and what each one resolves to. */
interface NodeBuiltins {
    "node:crypto": typeof import("node:crypto");
    "node:fs": typeof import("node:fs");
    "node:os": typeof import("node:os");
    "node:path": typeof import("node:path");
    "node:process": typeof import("node:process");
    "node:url": typeof import("node:url");
    "node:util": typeof import("node:util");
}

/** Resolves, and from then on returns, one of the modules above. */
type NodeBuiltinAccessor<S extends keyof NodeBuiltins> = () => NodeBuiltins[S];

/**
 * Resolves a Node core module the first time it is actually needed.
 *
 * A module-scope `import … from "node:*"` is what makes this package unloadable on a runtime that
 * ships no Node core. It survives bundling as a module-scope statement — either the `import` itself
 * or, once a bundler's CJS-interop pass has rewritten it, a `getBuiltinModule` call — and a bundler
 * has to assume that statement matters. So importing `serializeError` from `./error` evaluates the
 * whole barrel, `renderError`'s `node:fs` included, and the import throws on Cloudflare Workers
 * without `nodejs_compat` or on Vercel Edge before any of our code runs.
 *
 * Reaching for the module inside the function that needs it keeps module load free of Node core and
 * moves the failure to the call that genuinely cannot work there — `renderError` reads source files
 * off disk and was never going to run on an edge runtime, but `serializeError` alongside it is
 * fine. `__tests__/integration/dist-node-interop.test.ts` guards the built output against a
 * module-scope reach creeping back in.
 *
 * `process.getBuiltinModule` rather than `createRequire`: it needs no `node:module` import of its
 * own, and this package's `engines.node` (`^22.14.0 || >=24.10.0`) is past the versions that lack
 * it. A non-Node runtime that reports a `process` without implementing it is told which capability
 * is missing, instead of failing with `… is not a function` from somewhere inside a bundled chunk.
 * @param specifier The `node:`-prefixed module to resolve.
 * @returns An accessor that resolves the module on first call and memoises it.
 */
const nodeBuiltin = <S extends keyof NodeBuiltins>(specifier: S): NodeBuiltinAccessor<S> => {
    let module: NodeBuiltins[S] | undefined;

    return (): NodeBuiltins[S] => {
        if (module === undefined) {
            if (typeof process.getBuiltinModule !== "function") {
                throw new TypeError(
                    `[@visulima/error] Cannot load ${specifier}: this runtime implements no process.getBuiltinModule(). Requires Node ^22.14.0 || >=24.10.0, or another runtime providing process.getBuiltinModule().`,
                );
            }

            module = process.getBuiltinModule(specifier);
        }

        return module;
    };
};

export default nodeBuiltin;
