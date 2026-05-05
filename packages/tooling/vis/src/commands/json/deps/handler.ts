import type { Toolbox } from "@visulima/cerebro";
import { relative } from "@visulima/path";

import { filterDepInstances } from "../../../util/json-deps-filter";
import type { DepInstance, DepType } from "../../../util/workspace-deps";
import { iterateWorkspaceDeps } from "../../../util/workspace-deps";
import type { JsonDepsOptions } from "./index";

const KNOWN_DEP_TYPES: ReadonlySet<DepType> = new Set<DepType>([
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "overrides",
    "peerDependencies",
    "pnpm.overrides",
    "resolutions",
]);

const parseDepTypes = (raw: string[] | undefined): DepType[] | undefined => {
    if (!raw || raw.length === 0) {
        return undefined;
    }

    const parsed: DepType[] = [];
    const invalid: string[] = [];

    for (const entry of raw) {
        for (const piece of entry.split(",")) {
            const trimmed = piece.trim();

            if (!trimmed) {
                continue;
            }

            if (KNOWN_DEP_TYPES.has(trimmed as DepType)) {
                parsed.push(trimmed as DepType);
            } else {
                invalid.push(trimmed);
            }
        }
    }

    if (invalid.length > 0) {
        throw new Error(`Unknown --dep-type value(s): ${invalid.join(", ")}. Valid: ${[...KNOWN_DEP_TYPES].join(", ")}`);
    }

    return parsed.length > 0 ? parsed : undefined;
};

const toRecord = (instance: DepInstance, workspaceRoot: string): Record<string, unknown> => {
    return {
        depName: instance.depName,
        depType: instance.depType,
        isInternal: instance.isInternal,
        packageDir: instance.packageDir,
        packageJsonPath: relative(workspaceRoot, instance.packageJsonPath),
        packageName: instance.packageName,
        specifier: instance.specifier,
    };
};

export const jsonDepsExecute = async ({ options, workspaceRoot: wsRoot }: Toolbox<Console, JsonDepsOptions>): Promise<void> => {
    const workspaceRoot = wsRoot ?? process.cwd();
    const format = (options.format ?? "ndjson").toLowerCase();

    if (format !== "ndjson" && format !== "json") {
        throw new Error(`--format must be one of: ndjson, json (got "${String(options.format)}")`);
    }

    if (options.internalOnly && options.externalOnly) {
        throw new Error("--internal-only and --external-only are mutually exclusive");
    }

    const depTypes = parseDepTypes(options.depType);

    const instances = iterateWorkspaceDeps(workspaceRoot);
    const filtered = filterDepInstances(instances, {
        depTypes,
        excludePatterns: options.exclude,
        externalOnly: options.externalOnly,
        includePatterns: options.include,
        internalOnly: options.internalOnly,
    });

    if (format === "ndjson") {
        for (const instance of filtered) {
            process.stdout.write(`${JSON.stringify(toRecord(instance, workspaceRoot))}\n`);
        }

        return;
    }

    const records = filtered.map((instance) => toRecord(instance, workspaceRoot));
    const indent = options.pretty ? 2 : undefined;

    process.stdout.write(`${JSON.stringify(records, null, indent)}\n`);
};
