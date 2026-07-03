// @vitest-environment node
import type { ViteDevServer } from "vite";
import { describe, expect, it } from "vitest";

import { getViteConfig } from "../../../src/rpc/functions/vite-config";

type DeepConfig = Record<string, unknown>;

const makeServer = (config: DeepConfig): ViteDevServer =>
    ({
        config: {
            base: "/",
            cacheDir: "/cache",
            mode: "development",
            plugins: [],
            publicDir: "/public",
            root: "/project",
            ...config,
        },
    }) as unknown as ViteDevServer;

describe("rpc/functions/vite-config", () => {
    describe(getViteConfig, () => {
        it("returns the minimal snapshot for a bare config", async () => {
            expect.assertions(5);

            const result = await getViteConfig(makeServer({}));

            expect(result.base).toBe("/");
            expect(result.root).toBe("/project");
            expect(result.mode).toBe("development");
            expect(result.plugins).toEqual([]);
            expect(result.css.preprocessors).toEqual([]);
        });

        it("collects only named plugins and forwards enforce", async () => {
            expect.assertions(2);

            const result = await getViteConfig(
                makeServer({
                    plugins: [
                        { enforce: "pre", name: "named-pre" },
                        { name: "named-plain" },
                        // falsy / unnamed entries are filtered out
                        undefined,
                        null,
                        {},
                    ],
                }),
            );

            expect(result.plugins).toHaveLength(2);
            expect(result.plugins).toStrictEqual([
                { enforce: "pre", name: "named-pre" },
                { enforce: undefined, name: "named-plain" },
            ]);
        });

        it("normalizes an array alias and serializes RegExp finds", async () => {
            expect.assertions(1);

            const result = await getViteConfig(
                makeServer({
                    resolve: {
                        alias: [
                            { find: "@", replacement: "/src" },
                            { find: /^~(.*)$/, replacement: "/node_modules/$1" },
                            // entries without find/replacement are dropped
                            { something: "else" },
                            null,
                            undefined,
                        ],
                    },
                }),
            );

            expect(result.resolve.alias).toStrictEqual([
                { find: "@", replacement: "/src" },
                { find: "/^~(.*)$/", replacement: "/node_modules/$1" },
            ]);
        });

        it("coerces missing alias find/replacement to empty strings", async () => {
            expect.assertions(1);

            const result = await getViteConfig(
                makeServer({
                    resolve: {
                        alias: [{ find: "only-find" }, { replacement: "only-replacement" }],
                    },
                }),
            );

            expect(result.resolve.alias).toStrictEqual([
                { find: "only-find", replacement: "" },
                { find: "", replacement: "only-replacement" },
            ]);
        });

        it("normalizes an object alias to string values", async () => {
            expect.assertions(1);

            const result = await getViteConfig(
                makeServer({
                    resolve: {
                        alias: { "@": "/src", num: 123 },
                    },
                }),
            );

            expect(result.resolve.alias).toStrictEqual({ "@": "/src", num: "123" });
        });

        it("leaves alias undefined when it is neither array nor object", async () => {
            expect.assertions(1);

            const result = await getViteConfig(
                makeServer({
                    resolve: { alias: "not-supported" },
                }),
            );

            expect(result.resolve.alias).toBeUndefined();
        });

        it("extracts proxy route keys without leaking targets", async () => {
            expect.assertions(1);

            const result = await getViteConfig(
                makeServer({
                    server: {
                        proxy: {
                            "/api": "http://localhost:3000",
                            "/ws": { target: "ws://localhost:4000", ws: true },
                        },
                    },
                }),
            );

            expect(result.server.proxy).toStrictEqual(["/api", "/ws"]);
        });

        it("treats hmr === false as disabled", async () => {
            expect.assertions(2);

            const result = await getViteConfig(makeServer({ server: { hmr: false } }));

            expect(result.server.hmrEnabled).toBe(false);
            expect(result.server.hmrPort).toBeUndefined();
        });

        it("reads hmr port from an hmr object", async () => {
            expect.assertions(2);

            const result = await getViteConfig(makeServer({ server: { hmr: { port: 24_678 } } }));

            expect(result.server.hmrEnabled).toBe(true);
            expect(result.server.hmrPort).toBe(24_678);
        });

        it("normalizes middlewareMode object to true", async () => {
            expect.assertions(1);

            const result = await getViteConfig(makeServer({ server: { middlewareMode: { server: {} } } }));

            expect(result.server.middlewareMode).toBe(true);
        });

        it("normalizes middlewareMode boolean", async () => {
            expect.assertions(1);

            const result = await getViteConfig(makeServer({ server: { middlewareMode: true } }));

            expect(result.server.middlewareMode).toBe(true);
        });

        it("leaves middlewareMode undefined when not set", async () => {
            expect.assertions(1);

            const result = await getViteConfig(makeServer({ server: {} }));

            expect(result.server.middlewareMode).toBeUndefined();
        });

        it("coerces cors and derives https from presence", async () => {
            expect.assertions(2);

            const result = await getViteConfig(
                makeServer({
                    server: { cors: 1 as unknown as boolean, https: {} },
                }),
            );

            expect(result.server.cors).toBe(true);
            expect(result.server.https).toBe(true);
        });

        it("leaves cors undefined and https false when absent", async () => {
            expect.assertions(2);

            const result = await getViteConfig(makeServer({ server: {} }));

            expect(result.server.cors).toBeUndefined();
            expect(result.server.https).toBe(false);
        });

        it("maps build, css preprocessor keys and numeric assetsInlineLimit", async () => {
            expect.assertions(3);

            const result = await getViteConfig(
                makeServer({
                    build: { assetsInlineLimit: 4096, minify: "esbuild", outDir: "out" },
                    css: { devSourcemap: true, preprocessorOptions: { less: {}, scss: {} } },
                }),
            );

            expect(result.build.assetsInlineLimit).toBe(4096);
            expect(result.build.outDir).toBe("out");
            expect(result.css.preprocessors).toStrictEqual(["less", "scss"]);
        });

        it("drops non-numeric assetsInlineLimit", async () => {
            expect.assertions(1);

            const result = await getViteConfig(
                makeServer({
                    build: { assetsInlineLimit: "4kb" },
                }),
            );

            expect(result.build.assetsInlineLimit).toBeUndefined();
        });

        it("maps esbuild block when present", async () => {
            expect.assertions(1);

            const result = await getViteConfig(
                makeServer({
                    esbuild: { jsx: "automatic", jsxImportSource: "preact" },
                }),
            );

            expect(result.esbuild).toStrictEqual({
                jsx: "automatic",
                jsxFactory: undefined,
                jsxFragment: undefined,
                jsxImportSource: "preact",
                target: undefined,
            });
        });

        it("leaves esbuild undefined when not set", async () => {
            expect.assertions(1);

            const result = await getViteConfig(makeServer({}));

            expect(result.esbuild).toBeUndefined();
        });

        it("keeps envDir only when it is a string", async () => {
            expect.assertions(2);

            const stringResult = await getViteConfig(makeServer({ envDir: "/env" }));
            const objectResult = await getViteConfig(makeServer({ envDir: { weird: true } }));

            expect(stringResult.envDir).toBe("/env");
            expect(objectResult.envDir).toBeUndefined();
        });

        it("normalizes ssr.noExternal boolean, array and other", async () => {
            expect.assertions(4);

            const boolResult = await getViteConfig(makeServer({ ssr: { noExternal: true } }));
            const arrayResult = await getViteConfig(makeServer({ ssr: { noExternal: ["pkg-a"] } }));
            const otherResult = await getViteConfig(makeServer({ ssr: { noExternal: "pkg" } }));

            expect(boolResult.ssr?.noExternal).toBe(true);
            expect(arrayResult.ssr?.noExternal).toStrictEqual(["pkg-a"]);
            expect(otherResult.ssr?.noExternal).toBeUndefined();
            expect(otherResult.ssr?.external).toBeUndefined();
        });

        it("keeps ssr.external only when it is an array", async () => {
            expect.assertions(1);

            const result = await getViteConfig(makeServer({ ssr: { external: ["a", "b"] } }));

            expect(result.ssr?.external).toStrictEqual(["a", "b"]);
        });

        it("leaves ssr undefined when not set", async () => {
            expect.assertions(1);

            const result = await getViteConfig(makeServer({}));

            expect(result.ssr).toBeUndefined();
        });
    });
});
