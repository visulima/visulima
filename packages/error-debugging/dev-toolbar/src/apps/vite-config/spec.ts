import { createBuilder } from "../../json-view/builder";
import type { PluginInfo, ViteConfig, ViteConfigElement, ViteConfigSpec } from "./types";

/** Shortens a path to its last two segments, for the header chip. */
const tailSegments = (path: string, count: number): string => `…/${path.replaceAll("\\", "/").split("/").slice(-count).join("/")}`;

const countAlias = (alias: unknown): number => {
    if (Array.isArray(alias)) {
        return alias.length;
    }

    if (typeof alias === "object" && alias !== null) {
        return Object.keys(alias).length;
    }

    return 0;
};

/** Normalizes both alias forms — array of `{find, replacement}` and plain record — to table rows. */
const aliasRows = (alias: unknown): { key: string; value: string }[] => {
    if (Array.isArray(alias)) {
        return (alias as { find?: string; replacement?: string }[])
            .filter((entry) => entry?.find !== undefined)
            .map((entry) => {
                return { key: String(entry.find), value: String(entry.replacement ?? "") };
            });
    }

    if (typeof alias === "object" && alias !== null) {
        return Object.entries(alias as Record<string, unknown>).map(([key, value]) => {
            return { key, value: String(value) };
        });
    }

    return [];
};

/** Panel-shaped helpers over the shared element builder. */
const createViteConfigBuilder = () => {
    const { add, elements } = createBuilder<ViteConfigElement>();

    /**
     * One `KeyValue` per defined entry; absent values produce no element.
     *
     * Takes ordered pairs rather than an object so the rows read in the order
     * a person scans them, not the order the RPC module happens to declare its
     * keys in — and so key-sorting lint cannot silently reorder the panel.
     */
    const keyValues = (entries: [string, unknown][]): string[] =>
        entries.filter(([, value]) => value !== undefined && value !== null).map(([label, value]) => add({ props: { label, value }, type: "KeyValue" }));

    /** A titled `Section`, or nothing when it would be empty. */
    const section = (title: string | undefined, children: string[]): string[] => {
        if (children.length === 0) {
            return [];
        }

        return [add({ children, props: title === undefined ? {} : { title }, type: "Section" })];
    };

    const pane = (children: string[]): string => add({ children, props: { variant: "pane" }, type: "Stack" });

    return { add, elements, keyValues, pane, section };
};

/**
 * Builds the Vite config panel as a JSON view spec.
 *
 * Pure: no Preact, no DOM, no RPC. That is the point — the panel's content is
 * data, so it can be asserted in a unit test, rendered by any renderer, and
 * handed to an agent without a browser.
 */

const buildViteConfigSpec = (config: ViteConfig): ViteConfigSpec => {
    const { add, elements, keyValues, pane, section } = createViteConfigBuilder();

    const plugins: PluginInfo[] = config.plugins ?? [];
    const envEntries = Object.entries(config.env ?? {});
    const defineEntries = Object.entries(config.define ?? {});
    const aliases = aliasRows(config.resolve?.alias);
    const hasOptimizeDeps = (config.optimizeDeps?.include?.length ?? 0) > 0 || (config.optimizeDeps?.exclude?.length ?? 0) > 0;

    // ── Header ──────────────────────────────────────────────────────────────
    const badges: { label: string; variant?: "destructive" | "secondary" | "success" }[] = [];

    if (config.mode) {
        // Not `variant: undefined` — the spec travels as JSON, and an explicit
        // undefined is dropped by `JSON.stringify`, so it would not round trip.
        badges.push(config.mode === "production" ? { label: config.mode, variant: "destructive" } : { label: config.mode });
    }

    if (config.server?.https) {
        badges.push({ label: "HTTPS", variant: "success" });
    }

    if (config.ssr) {
        badges.push({ label: "SSR", variant: "secondary" });
    }

    const chips = [{ label: tailSegments(config.root, 2), title: config.root }];

    if (config.base && config.base !== "/") {
        chips.push({ label: `base: ${config.base}`, title: config.base });
    }

    const header = add({
        on: { action: { action: "refresh" } },
        props: { actionLabel: "Refresh", badges, chips },
        type: "HeaderBar",
    });

    const stats = add({
        props: {
            stats: [
                { label: "plugins", value: plugins.length },
                { label: "env vars", value: envEntries.length },
                { label: "defines", value: defineEntries.length },
                { label: "aliases", value: countAlias(config.resolve?.alias) },
            ],
        },
        type: "StatStrip",
    });

    // ── Server ──────────────────────────────────────────────────────────────
    const serverPane = pane([
        ...section(undefined, [
            ...keyValues([
                ["host", config.server?.host ?? false],
                ["port", config.server?.port],
                ["strictPort", config.server?.strictPort],
                ["https", config.server?.https],
                ["open", config.server?.open],
                ["cors", config.server?.cors],
                ["origin", config.server?.origin],
                ["middlewareMode", config.server?.middlewareMode],
            ]),
        ]),
        ...section(
            "HMR",
            keyValues([
                ["enabled", config.server?.hmrEnabled ?? true],
                ["port", config.server?.hmrPort],
            ]),
        ),
        ...section(
            "Proxy Routes",
            (config.server?.proxy ?? []).map((route) => add({ props: { value: route }, type: "Row" })),
        ),
    ]);

    // ── Plugins ─────────────────────────────────────────────────────────────
    const pluginsPane = pane([
        plugins.length === 0 ? add({ props: { text: "No plugins registered" }, type: "Note" }) : add({ props: { plugins }, type: "PluginList" }),
    ]);

    // ── Build ───────────────────────────────────────────────────────────────
    const buildPane = pane([
        ...section(
            undefined,
            keyValues([
                ["outDir", config.build?.["outDir"]],
                ["target", config.build?.["target"]],
                ["minify", config.build?.["minify"]],
                ["sourcemap", config.build?.["sourcemap"]],
                ["cssCodeSplit", config.build?.["cssCodeSplit"]],
                ["assetsDir", config.build?.["assetsDir"]],
                ["assetsInlineLimit", config.build?.["assetsInlineLimit"]],
                ["chunkSizeWarningLimit", config.build?.["chunkSizeWarningLimit"]],
                ["emptyOutDir", config.build?.["emptyOutDir"]],
                ["reportCompressedSize", config.build?.["reportCompressedSize"]],
            ]),
        ),
        ...section(
            "esbuild Transform",
            keyValues([
                ["jsx", config.esbuild?.["jsx"]],
                ["jsxFactory", config.esbuild?.["jsxFactory"]],
                ["jsxFragment", config.esbuild?.["jsxFragment"]],
                ["jsxImportSource", config.esbuild?.["jsxImportSource"]],
                ["target", config.esbuild?.["target"]],
            ]),
        ),
        ...section(
            "CSS",
            keyValues([
                ["devSourcemap", config.css?.devSourcemap],
                ["preprocessors", config.css?.preprocessors],
            ]),
        ),
        // An explicitly empty include/exclude renders nothing, as before: a
        // bare `[]` would otherwise show a section containing an "empty" pill.
        ...section(
            "Optimize Deps",
            hasOptimizeDeps
                ? keyValues([
                    ["include", config.optimizeDeps?.include],
                    ["exclude", config.optimizeDeps?.exclude],
                ])
                : [],
        ),
        ...section(
            "SSR",
            keyValues([
                ["target", config.ssr?.target],
                ["external", config.ssr?.external],
                ["noExternal", config.ssr?.noExternal],
            ]),
        ),
    ]);

    // ── Resolve ─────────────────────────────────────────────────────────────
    const resolvePane = pane([
        ...section(
            undefined,
            keyValues([
                ["extensions", config.resolve?.extensions],
                ["conditions", config.resolve?.conditions],
                ["mainFields", config.resolve?.mainFields],
                ["dedupe", config.resolve?.dedupe],
                ["preserveSymlinks", config.resolve?.preserveSymlinks],
            ]),
        ),
        ...section("Alias", aliases.length === 0 ? [] : [add({ props: { keyLabel: "Find", rows: aliases, valueLabel: "Replacement" }, type: "PairTable" })]),
        ...section(
            "Paths",
            keyValues([
                ["root", config.root],
                ["publicDir", config.publicDir],
                ["cacheDir", config.cacheDir],
                ["envDir", config.envDir],
                ["envPrefix", config.envPrefix],
            ]),
        ),
    ]);

    // ── Env & Define ────────────────────────────────────────────────────────
    const envPane = pane([
        envEntries.length === 0
            ? add({ props: { text: "No environment variables exposed to the client." }, type: "Note" })
            : add({
                props: {
                    rows: envEntries.map(([key, value]) => {
                        return { key, value };
                    }),
                },
                type: "EnvTable",
            }),
        ...section(
            "Define Constants",
            defineEntries.length === 0
                ? []
                : [
                    add({
                        props: {
                            keyLabel: "Identifier",
                            keyTone: "amber",
                            rows: defineEntries.map(([key, value]) => {
                                return { key, value: JSON.stringify(value) };
                            }),
                            showCopy: true,
                            valueLabel: "Replacement",
                        },
                        type: "PairTable",
                    }),
                ],
        ),
    ]);

    const tabs = add({
        children: [serverPane, pluginsPane, buildPane, resolvePane, envPane],
        props: {
            tabs: [
                { label: "Server", value: "server" },
                { label: `Plugins (${plugins.length})`, value: "plugins" },
                { label: "Build", value: "build" },
                { label: "Resolve", value: "resolve" },
                { label: `Env & Define (${envEntries.length + defineEntries.length})`, value: "env" },
            ],
        },
        type: "TabView",
    });

    const root = add({ children: [header, stats, tabs], props: { class: "flex flex-col h-full space-y-0" }, type: "Stack" });

    return { elements, root, state: {} };
};

export default buildViteConfigSpec;
