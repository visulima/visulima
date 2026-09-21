import { validateSpec } from "@json-render/core";
import { describe, expect, it } from "vitest";

import buildViteConfigSpec from "../../../src/apps/vite-config/spec";
import type { ViteConfig, ViteConfigElement } from "../../../src/apps/vite-config/types";

const minimalConfig: ViteConfig = { base: "/", mode: "development", root: "/home/user/project" };

const elementsOfType = (config: ViteConfig, type: ViteConfigElement["type"]): ViteConfigElement[] =>
    Object.values(buildViteConfigSpec(config).elements).filter((element) => element.type === type);

describe(buildViteConfigSpec, () => {
    it("produces a structurally valid spec for a minimal config", () => {
        expect.hasAssertions();

        const spec = buildViteConfigSpec(minimalConfig);

        expect(validateSpec(spec, { checkOrphans: true })).toStrictEqual({ issues: [], valid: true });
    });

    it("produces a structurally valid spec for a fully populated config", () => {
        expect.hasAssertions();

        const spec = buildViteConfigSpec({
            ...minimalConfig,
            base: "/app/",
            build: { minify: "esbuild", outDir: "dist" },
            cacheDir: "/home/user/project/node_modules/.vite",
            css: { devSourcemap: true, preprocessors: ["scss"] },
            define: { __VERSION__: "1.0.0" },
            env: { BASE_URL: "/", SECRET_TOKEN: "abc" },
            esbuild: { jsx: "automatic" },
            optimizeDeps: { exclude: ["b"], include: ["a"] },
            plugins: [{ name: "vite:core" }, { enforce: "pre", name: "my-plugin" }],
            resolve: { alias: { "@": "/home/user/project/src" }, extensions: [".ts"] },
            server: { https: true, port: 5173, proxy: ["/api"], strictPort: true },
            ssr: { target: "node" },
        });

        expect(validateSpec(spec, { checkOrphans: true })).toStrictEqual({ issues: [], valid: true });
    });

    it("emits no KeyValue element for a config key that is absent", () => {
        expect.hasAssertions();

        const labels = elementsOfType(minimalConfig, "KeyValue").map((element) => (element.props as { label: string }).label);

        expect(labels).not.toContain("port");
    });

    it("omits a section entirely when every one of its keys is absent", () => {
        expect.hasAssertions();

        const titles = elementsOfType(minimalConfig, "Section").map((element) => (element.props as { title?: string }).title);

        expect(titles).not.toContain("Proxy Routes");
    });

    it("normalizes a record alias into table rows", () => {
        expect.hasAssertions();

        const [table] = elementsOfType({ ...minimalConfig, resolve: { alias: { "@": "/src", "~": "/root" } } }, "PairTable");

        expect((table?.props as { rows: unknown }).rows).toStrictEqual([
            { key: "@", value: "/src" },
            { key: "~", value: "/root" },
        ]);
    });

    it("normalizes an array alias into the same table rows", () => {
        expect.hasAssertions();

        const [table] = elementsOfType({ ...minimalConfig, resolve: { alias: [{ find: "@", replacement: "/src" }] } }, "PairTable");

        expect((table?.props as { rows: unknown }).rows).toStrictEqual([{ key: "@", value: "/src" }]);
    });

    it("counts both alias forms the same way in the stats strip", () => {
        expect.hasAssertions();

        const asRecord = elementsOfType({ ...minimalConfig, resolve: { alias: { "@": "/src" } } }, "StatStrip");
        const asArray = elementsOfType({ ...minimalConfig, resolve: { alias: [{ find: "@", replacement: "/src" }] } }, "StatStrip");

        expect(asRecord[0]?.props).toStrictEqual(asArray[0]?.props);
    });

    it("puts the plugin and env counts in the tab labels", () => {
        expect.hasAssertions();

        const [tabs] = elementsOfType(
            { ...minimalConfig, define: { __DEV__: true }, env: { MODE: "development" }, plugins: [{ name: "a" }, { name: "b" }] },
            "TabView",
        );

        expect((tabs?.props as { tabs: { label: string }[] }).tabs.map((tab) => tab.label)).toStrictEqual([
            "Server",
            "Plugins (2)",
            "Build",
            "Resolve",
            "Env & Define (2)",
        ]);
    });

    it("binds the header button to the refresh action", () => {
        expect.hasAssertions();

        const [header] = elementsOfType(minimalConfig, "HeaderBar");

        // `action`, not `click`: HeaderBar reads its handler from `onAction`, and
        // a `click` binding would render a button that silently does nothing.
        expect(header?.on).toStrictEqual({ action: { action: "refresh" } });
    });

    it("explains an empty env section instead of rendering an empty table", () => {
        expect.hasAssertions();

        const notes = elementsOfType(minimalConfig, "Note").map((element) => (element.props as { text: string }).text);

        expect(notes).toContain("No environment variables exposed to the client.");
    });

    it("hands the plugin list its plugins rather than pre-rendering rows", () => {
        expect.hasAssertions();

        const [list] = elementsOfType({ ...minimalConfig, plugins: [{ enforce: "pre", name: "my-plugin" }] }, "PluginList");

        expect((list?.props as { plugins: unknown }).plugins).toStrictEqual([{ enforce: "pre", name: "my-plugin" }]);
    });

    it("is serializable — the spec survives a JSON round trip unchanged", () => {
        expect.hasAssertions();

        const spec = buildViteConfigSpec({ ...minimalConfig, plugins: [{ name: "vite:core" }], server: { port: 5173 } });

        // Deliberately not `structuredClone` — the point is that the spec
        // survives a *JSON* round trip, which is how it reaches an RPC client
        // or an agent. structuredClone keeps `undefined` values that
        // JSON.stringify drops, hiding exactly the bug this asserts against.
        // eslint-disable-next-line unicorn/prefer-structured-clone
        expect(JSON.parse(JSON.stringify(spec))).toStrictEqual(spec);
    });
});
