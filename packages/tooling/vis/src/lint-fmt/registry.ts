import type { AdapterId, AdapterKind, ToolAdapter, ToolPresence } from "./config-types";

/**
 * Static registry of every adapter vis knows about. The order here
 * is the default precedence used by both `vis lint` and `vis fmt`.
 * After filtering by `kind` (or `both`), the resulting sequence
 * becomes:
 *
 *   lint: oxlint → biome → eslint → stylelint → deno-lint
 *   fmt:  oxfmt  → biome → dprint → prettier → deno-fmt
 *
 * Rust-native tools come first so they get a chance to short-circuit
 * cheap classes of issues before slower tools run. Biome sits in the
 * middle because it's "both": its lint position is between oxlint and
 * eslint; its fmt position between oxfmt and dprint. Stylelint is a
 * CSS-only late entry — it never collides on JS/TS files so order
 * with the others doesn't matter. Deno's two adapters come last
 * because Deno workspaces typically don't co-exist with the npm
 * toolchain; when they do, the npm-native tooling wins.
 *
 * Users can override with `lint.order` / `fmt.order` in
 * `vis.config.ts`. Adapters are imported lazily by their consumers —
 * keep this file free of cross-cutting imports so the registry stays
 * cheap to load.
 */
const ADAPTER_ORDER: ReadonlyArray<AdapterId> = [
    "oxlint",
    "oxfmt",
    "biome",
    "eslint",
    "dprint",
    "prettier",
    "stylelint",
    "ruff-check",
    "ruff-fmt",
    "markdownlint",
    "shellcheck",
    "deno-lint",
    "deno-fmt",
];

/**
 * Order adapters by precedence: `customOrder` (from `vis.config.ts`) first,
 * then the static `ADAPTER_ORDER`, then any adapter neither list knows about
 * appended so it still runs. Deduplicates by id.
 * @param adapters Detected adapters to order.
 * @param customOrder Optional user-specified id order that takes precedence.
 * @returns Adapters in effective precedence order.
 */
export const registerAdapters = (adapters: ReadonlyArray<ToolAdapter>, customOrder?: ReadonlyArray<AdapterId>): ReadonlyArray<ToolAdapter> => {
    const byId = new Map(adapters.map((a) => [a.id, a]));
    const ordered: ToolAdapter[] = [];
    const seen = new Set<AdapterId>();

    // `customOrder` (from `vis.config.ts#lint.order` / `fmt.order`) wins
    // over the static precedence. Adapters not listed there fall back to
    // the registry default so omitted entries still run.
    const primary = customOrder && customOrder.length > 0 ? customOrder : ADAPTER_ORDER;

    for (const id of primary) {
        const adapter = byId.get(id);

        if (adapter && !seen.has(id)) {
            ordered.push(adapter);
            seen.add(id);
        }
    }

    if (customOrder && customOrder.length > 0) {
        // Fall back to the static order for adapters the user didn't list.
        for (const id of ADAPTER_ORDER) {
            const adapter = byId.get(id);

            if (adapter && !seen.has(id)) {
                ordered.push(adapter);
                seen.add(id);
            }
        }
    }

    // Append any adapter neither the user nor the static order knows about
    // (defensive — keeps future adapters from disappearing).
    for (const adapter of adapters) {
        if (!seen.has(adapter.id)) {
            ordered.push(adapter);
            seen.add(adapter.id);
        }
    }

    return ordered;
};

/**
 * Filter detected adapters by kind (lint vs fmt). `both` matches
 * either.
 * @param detected Map of detected adapter id to presence.
 * @param all All adapters, in precedence order.
 * @param kind Which pipeline to select (`lint` or `fmt`).
 * @returns Adapter + presence pairs eligible for the requested kind, in order.
 */
export const adaptersByKind = (
    detected: Map<AdapterId, ToolPresence>,
    all: ReadonlyArray<ToolAdapter>,
    kind: "lint" | "fmt",
): { adapter: ToolAdapter; presence: ToolPresence }[] => {
    const out: { adapter: ToolAdapter; presence: ToolPresence }[] = [];

    for (const adapter of all) {
        const presence = detected.get(adapter.id);

        if (!presence) {
            continue;
        }

        if (matchesKind(adapter.kind, kind)) {
            out.push({ adapter, presence });
        }
    }

    return out;
};

const matchesKind = (adapterKind: AdapterKind, want: "lint" | "fmt"): boolean => adapterKind === want || adapterKind === "both";

/**
 * Group files by adapter via extension. Used by `vis fmt` to route
 * each file to the adapter that owns its extension.
 *
 * `extensionOverrides` lets the user pin a specific extension to a
 * specific adapter via vis.config.ts; without overrides, the first
 * adapter in `adapters` that claims the extension wins.
 * @param files Files to route.
 * @param adapters Eligible adapter + presence pairs, in precedence order.
 * @param extensionOverrides Extension → adapter id pins from `vis.config.ts`.
 * @returns Map of adapter id to the files routed to it (unclaimed files dropped).
 */
export const routeFilesByExtension = (
    files: ReadonlyArray<string>,
    adapters: ReadonlyArray<{ adapter: ToolAdapter; presence: ToolPresence }>,
    extensionOverrides: Record<string, AdapterId> = {},
): Map<AdapterId, string[]> => {
    const groups = new Map<AdapterId, string[]>();

    for (const file of files) {
        const extension = extensionOf(file);
        const adapterId = resolveAdapterForExtension(extension, adapters, extensionOverrides);

        if (!adapterId) {
            continue;
        }

        const bucket = groups.get(adapterId);

        if (bucket) {
            bucket.push(file);
        } else {
            groups.set(adapterId, [file]);
        }
    }

    return groups;
};

const extensionOf = (file: string): string => {
    const lastDot = file.lastIndexOf(".");

    if (lastDot === -1 || lastDot === file.length - 1) {
        return "";
    }

    return file.slice(lastDot + 1).toLowerCase();
};

const resolveAdapterForExtension = (
    extension: string,
    adapters: ReadonlyArray<{ adapter: ToolAdapter; presence: ToolPresence }>,
    overrides: Record<string, AdapterId>,
): AdapterId | undefined => {
    const override = overrides[extension];

    if (override && adapters.some((entry) => entry.adapter.id === override)) {
        return override;
    }

    for (const { adapter } of adapters) {
        if (adapter.extensions.includes(extension)) {
            return adapter.id;
        }
    }

    return undefined;
};
