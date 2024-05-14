import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AsyncOpts, PackageJSON, SyncOpts } from "resolve";
import resolver from "resolve";
import { legacy as resolveFields, resolve as resolveExports } from "resolve.exports";

import arrayFmt from "./array-fmt";

const baseDir = path.dirname(fileURLToPath(import.meta.url));

type Package = PackageJSON;
type PackageFilterFunction = (package_: Package, pkgfile: string) => Package;

export interface ResolveOptions {
    /** directories to begin resolving from (defaults to `[__dirname]`) */
    basedirs?: string[];
    /** name of the caller for error message (default to `Resolver`) */
    caller?: string;
    /** array of file extensions to search in order (defaults to `[".mjs", ".js", ".cjs", ".json"]`) */
    extensions?: ReadonlyArray<string> | string;
    /** transform the parsed `package.json` contents before looking at the "main" field */
    packageFilter?: PackageFilterFunction;
    /** don't resolve `basedirs` to real path before resolving. (defaults to `true`) */
    preserveSymlinks?: boolean;
}

interface ResolveDefaultOptions {
    basedirs: ReadonlyArray<string>;
    caller: string;
    extensions: ReadonlyArray<string>;
    packageFilter: PackageFilterFunction;
    preserveSymlinks: boolean;
}

interface PackageFilterBuilderOptions {
    conditions?: string[];
    fields?: string[];
}

type PackageFilterBuilderFunction = (options?: PackageFilterBuilderOptions) => PackageFilterFunction;

export const packageFilterBuilder: PackageFilterBuilderFunction = (options = {}) => {
    const conditions = options.conditions ?? ["style", "import", "require"];
    const fields = options.fields ?? ["style", "module", "main"];
    return (package_) => {
        // Check `exports` fields
        try {
            const resolvedExport = resolveExports(package_, ".", { conditions, unsafe: true });
            if (typeof resolvedExport === "string") {
                package_.main = resolvedExport;
                return package_;
            }
        } catch {
            /* noop */
        }

        // Check independent fields
        try {
            const resolvedField = resolveFields(package_, { browser: false, fields });
            if (typeof resolvedField === "string") {
                package_.main = resolvedField;
                return package_;
            }
        } catch {
            /* noop */
        }

        return package_;
    };
};

const defaultOptions: ResolveDefaultOptions = {
    basedirs: [baseDir],
    caller: "Resolver",
    extensions: [".mjs", ".js", ".cjs", ".json"],
    packageFilter: packageFilterBuilder(),
    preserveSymlinks: true,
};

const resolverAsync = async (id: string, options: AsyncOpts = {}): Promise<string | undefined> =>
    await new Promise((resolve) => resolver(id, options, (_, res) => resolve(res)));

export async function resolveAsync(ids: string[], userOptions: ResolveOptions): Promise<string> {
    const options = { ...defaultOptions, ...userOptions };
    for await (const basedir of options.basedirs) {
        const options_ = { ...options, basedir, basedirs: undefined, caller: undefined };
        for await (const id of ids) {
            const resolved = await resolverAsync(id, options_);

            if (resolved) {
                return resolved;
            }
        }
    }

    throw new Error(`${options.caller} could not resolve ${arrayFmt(ids)}`);
}

const resolverSync = (id: string, options: SyncOpts = {}): string | undefined => {
    try {
        return resolver.sync(id, options);
    } catch {}
};

export function resolveSync(ids: string[], userOptions: ResolveOptions): string {
    const options = { ...defaultOptions, ...userOptions };
    for (const basedir of options.basedirs) {
        const options_ = { ...options, basedir, basedirs: undefined, caller: undefined };
        for (const id of ids) {
            const resolved = resolverSync(id, options_);

            if (resolved) {
                return resolved;
            }
        }
    }

    throw new Error(`${options.caller} could not resolve ${arrayFmt(ids)}`);
}
