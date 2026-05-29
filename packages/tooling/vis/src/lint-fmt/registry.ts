import type { AdapterId, AdapterKind, ToolAdapter, ToolPresence } from "./config-types";

/**
 * Static registry of every adapter vis knows about. The order here
 * is the default precedence used by both `vis lint` and `vis fmt`.
 * After filtering by `kind` (or `both`), the resulting sequence
 * becomes:
 *
 *   lint: oxlint → biome → eslint
 *   fmt:  oxfmt  → biome → dprint → prettier
 *
 * Rust-native tools come first so they get a chance to short-circuit
 * cheap classes of issues before slower tools run. Biome sits in the
 * middle because it's "both": its lint position is between oxlint and
 * eslint; its fmt position between oxfmt and dprint.
 *
 * Users can override with `lint.order` / `fmt.order` in
 * `vis.config.ts`. Adapters are imported lazily by their consumers —
 * keep this file free of cross-cutting imports so the registry stays
 * cheap to load.
 */
const ADAPTER_ORDER: ReadonlyArray<AdapterId> = ["oxlint", "oxfmt", "biome", "eslint", "dprint", "prettier"];

export const registerAdapters = (adapters: ReadonlyArray<ToolAdapter>): ReadonlyArray<ToolAdapter> => {
    const byId = new Map(adapters.map((a) => [a.id, a]));
    const ordered: ToolAdapter[] = [];

    for (const id of ADAPTER_ORDER) {
        const adapter = byId.get(id);

        if (adapter) {
            ordered.push(adapter);
        }
    }

    // Append any adapter the static order doesn't know about (defensive — keeps
    // future adapters from disappearing if someone forgets to update ADAPTER_ORDER).
    for (const adapter of adapters) {
        if (!ADAPTER_ORDER.includes(adapter.id)) {
            ordered.push(adapter);
        }
    }

    return ordered;
};

/**
 * Filter detected adapters by kind (lint vs fmt). `both` matches
 * either.
 */
export const adaptersByKind = (
    detected: Map<AdapterId, ToolPresence>,
    all: ReadonlyArray<ToolAdapter>,
    kind: "lint" | "fmt",
): Array<{ adapter: ToolAdapter; presence: ToolPresence }> => {
    const out: Array<{ adapter: ToolAdapter; presence: ToolPresence }> = [];

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
