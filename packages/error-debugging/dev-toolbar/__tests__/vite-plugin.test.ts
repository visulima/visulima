// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the RPC server so configureServer doesn't attempt real fs work
const mockCreateServerRPCContext = vi.fn();

vi.mock(import("../src/rpc/server"), () => {
    return {
        createServerRPCContext: mockCreateServerRPCContext,
        default: mockCreateServerRPCContext,
    };
});

// Mock inject-source so the injectSourcePlugin.transform doesn't try to Babel-parse
vi.mock(import("../src/vite/inject-source.js"), () => {
    return {
        addSourceToJsx: vi.fn().mockReturnValue(undefined),
    };
});

const { devToolbar } = await import("../src/vite-plugin");

// ---- types ------------------------------------------------------------------

type PluginHookFn = (...args: unknown[]) => unknown;

interface MockPlugin {
    [key: string]: unknown;
    name: string;
    transform?: PluginHookFn | { handler: PluginHookFn };
}

// ---- mock factories ---------------------------------------------------------

const buildMockServer = (
    overrides: Partial<{
        config: { base: string; root: string };
        middlewares: { use: ReturnType<typeof vi.fn> };
        ws: { on: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };
    }> = {},
) => {
    return {
        config: { base: "/", root: "/project" },
        middlewares: { use: vi.fn() },
        ws: {
            on: vi.fn(),
            send: vi.fn(),
        },
        ...overrides,
    };
};

const buildMockResolvedConfig = (plugins: MockPlugin[] = [], base = "/", mode = "development") => {
    return {
        base,
        mode,
        plugins,
        root: "/project",
    };
};

// ---- helpers ----------------------------------------------------------------

type DevToolbarPlugins = ReturnType<typeof devToolbar>;

const findPlugin = (plugins: DevToolbarPlugins, name: string) => {
    const found = plugins.find((p) => p.name === name);

    if (!found) {
        throw new Error(`Plugin "${name}" not found`);
    }

    return found;
};

// ---- tests ------------------------------------------------------------------

describe("devToolbar()", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("plugin shape", () => {
        it("returns an array of three plugins", () => {
            expect.hasAssertions();

            const plugins = devToolbar();

            expect(Array.isArray(plugins)).toBe(true);
            expect(plugins).toHaveLength(3);
        });

        it("returns the main plugin named '@visulima/dev-toolbar'", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            expect(main.name).toBe("@visulima/dev-toolbar");
        });

        it("returns the inject-source plugin", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const injectSource = findPlugin(plugins, "@visulima/dev-toolbar:inject-source");

            expect(injectSource.name).toBe("@visulima/dev-toolbar:inject-source");
        });

        it("returns the remove-on-build plugin", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const removeOnBuild = findPlugin(plugins, "@visulima/dev-toolbar:remove-on-build");

            expect(removeOnBuild.name).toBe("@visulima/dev-toolbar:remove-on-build");
        });

        it("main plugin has enforce: 'pre'", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            expect(main.enforce).toBe("pre");
        });

        it("main plugin has apply: 'serve'", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            expect(main.apply).toBe("serve");
        });

        it("inject-source plugin has enforce: 'pre'", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const injectSource = findPlugin(plugins, "@visulima/dev-toolbar:inject-source");

            expect(injectSource.enforce).toBe("pre");
        });

        it("main plugin exposes the expected hooks", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            expect(main.config).toBeDefined();
            expect(main.configResolved).toBeDefined();
            expect(main.configureServer).toBeDefined();
            expect(main.load).toBeDefined();
            expect(main.resolveId).toBeDefined();
            expect(main.transform).toBeDefined();
            expect(main.transformIndexHtml).toBeDefined();
        });

        it("returns an empty array when enabled is false", () => {
            expect.hasAssertions();

            const plugins = devToolbar({ enabled: false });

            expect(plugins).toHaveLength(0);
        });

        it("returns the full plugin array when enabled is true", () => {
            expect.hasAssertions();

            const plugins = devToolbar({ enabled: true });

            expect(plugins).toHaveLength(3);
        });

        it("works with no options passed (defaults apply)", () => {
            expect.hasAssertions();

            expect(() => {
                devToolbar();
            }).not.toThrow();
        });

        it("works with a full options object", () => {
            expect.hasAssertions();

            expect(() => {
                devToolbar({
                    apps: { inspector: true },
                    closeOnOutsideClick: false,
                    defaultVisible: false,
                    height: 50,
                    placement: "bottom-right",
                    position: "bottom",
                    reduceMotion: true,
                    removeDevtoolsOnBuild: false,
                    width: 60,
                });
            }).not.toThrow();
        });
    });

    describe("config hook", () => {
        it("returns a server.watch.ignored array that excludes .devtoolbar", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");
            const result = (main.config as PluginHookFn)() as { server: { watch: { ignored: string[] } } };

            expect(result.server.watch.ignored).toContain("**/.devtoolbar/**");
        });
    });

    describe("configResolved hook", () => {
        it("stores the resolved config without throwing", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");
            const mockConfig = buildMockResolvedConfig();

            expect(() => {
                (main.configResolved as PluginHookFn)(mockConfig);
            }).not.toThrow();
        });

        it("wraps a babel plugin's transform function so dev-toolbar paths are skipped", () => {
            expect.hasAssertions();

            const originalTransform = vi.fn();
            const babelPlugin: MockPlugin = {
                name: "vite:babel-plugin",
                transform: originalTransform,
            };

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");
            const mockConfig = buildMockResolvedConfig([babelPlugin]);

            (main.configResolved as PluginHookFn)(mockConfig);

            // The babel plugin's transform should have been wrapped (replaced by a wrapper fn)
            expect(babelPlugin.transform).not.toBe(originalTransform);
        });

        it("wraps babel plugin transform when it's in handler-object form", () => {
            expect.hasAssertions();

            const originalHandler = vi.fn();
            const babelPlugin: MockPlugin = {
                name: "vite:babel-something",
                transform: { handler: originalHandler },
            };

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");
            const mockConfig = buildMockResolvedConfig([babelPlugin]);

            (main.configResolved as PluginHookFn)(mockConfig);

            expect((babelPlugin.transform as { handler: PluginHookFn }).handler).not.toBe(originalHandler);
        });

        it("skips non-babel plugins entirely", () => {
            expect.hasAssertions();

            const vuePlugin: MockPlugin = {
                name: "vite:vue",
                transform: vi.fn(),
            };

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");
            const originalTransform = vuePlugin.transform;

            (main.configResolved as PluginHookFn)(buildMockResolvedConfig([vuePlugin]));

            expect(vuePlugin.transform).toBe(originalTransform);
        });

        it("sets appendTo to a router RegExp when TanStack Start plugin is detected", () => {
            expect.hasAssertions();

            const tanstackPlugin: MockPlugin = { name: "tanstack-start-core:config" };
            const options: Record<string, unknown> = {};
            const plugins = devToolbar(options);
            const main = findPlugin(plugins, "@visulima/dev-toolbar");
            const mockConfig = buildMockResolvedConfig([tanstackPlugin]);

            (main.configResolved as PluginHookFn)(mockConfig);

            expect(options["appendTo"]).toBeInstanceOf(RegExp);
        });
    });

    describe("configureServer hook", () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("calls createServerRPCContext with the dev server", () => {
            expect.hasAssertions();

            const server = buildMockServer();
            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            // configResolved must run first so `config` is set
            (main.configResolved as PluginHookFn)(buildMockResolvedConfig());
            (main.configureServer as PluginHookFn)(server);

            expect(mockCreateServerRPCContext).toHaveBeenCalledWith(server, undefined, { editor: undefined, readFile: undefined });
        });

        it("registers a connection listener on server.ws", () => {
            expect.hasAssertions();

            const server = buildMockServer();
            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            (main.configResolved as PluginHookFn)(buildMockResolvedConfig());
            (main.configureServer as PluginHookFn)(server);

            expect(server.ws.on).toHaveBeenCalledWith("connection", expect.any(Function));
        });

        it("the connection handler sends dev-toolbar:init to clients", () => {
            expect.hasAssertions();

            const server = buildMockServer();
            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            (main.configResolved as PluginHookFn)(buildMockResolvedConfig());
            (main.configureServer as PluginHookFn)(server);

            const connectionHandler = server.ws.on.mock.calls.find((c: unknown[]) => c[0] === "connection")?.[1] as (() => void) | undefined;

            expect(connectionHandler).toBeDefined();

            connectionHandler?.();

            expect(server.ws.send).toHaveBeenCalledWith({
                event: "dev-toolbar:init",
                type: "custom",
            });
        });

        it("registers the /__devtoolbar/events SSE middleware", () => {
            expect.hasAssertions();

            const server = buildMockServer();
            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            (main.configResolved as PluginHookFn)(buildMockResolvedConfig());
            (main.configureServer as PluginHookFn)(server);

            expect(server.middlewares.use).toHaveBeenCalledWith("/__devtoolbar/events", expect.any(Function));
        });
    });

    describe("resolveId hook", () => {
        it("resolves the virtual options module id", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            const result = (main.resolveId as PluginHookFn)("virtual:visulima-dev-toolbar-options");

            // Resolved to the internal sentinel ID with \0 prefix
            expect(result).toBe("\0virtual:visulima-dev-toolbar-options");
        });

        it("resolves virtual path modules to a resource URL with the query marker", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            const result = (main.resolveId as PluginHookFn)("virtual:visulima-dev-toolbar-path:client/overlay.js") as string;

            expect(result).toMatch(/client\/overlay\.js\?__visulima-dev-toolbar-resource$/);
        });

        it("returns undefined for unrecognized module ids", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            expect((main.resolveId as PluginHookFn)("react")).toBeUndefined();
            expect((main.resolveId as PluginHookFn)("./some-local-module")).toBeUndefined();
        });
    });

    describe("load hook", () => {
        it("returns undefined for unrecognized ids", async () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            (main.configResolved as PluginHookFn)(buildMockResolvedConfig());

            const result = await (main.load as PluginHookFn).call({ addWatchFile: vi.fn() }, "some/random/module.js");

            expect(result).toBeUndefined();
        });

        it("returns a JS module string for the resolved virtual options id", async () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            (main.configResolved as PluginHookFn)(buildMockResolvedConfig());

            const result = (await (main.load as PluginHookFn).call({ addWatchFile: vi.fn() }, "\0virtual:visulima-dev-toolbar-options")) as string;

            expect(result).toMatch(/^export default /);
            expect(result).toContain('"placement"');
            expect(result).toContain('"position"');
        });

        it("virtual options defaults: settings and viteConfig apps enabled, others disabled", async () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            (main.configResolved as PluginHookFn)(buildMockResolvedConfig());

            const raw = (await (main.load as PluginHookFn).call({ addWatchFile: vi.fn() }, "\0virtual:visulima-dev-toolbar-options")) as string;

            const exported = JSON.parse(raw.replace(/^export default /, "").replace(/;$/, "")) as Record<string, unknown>;
            const apps = exported["apps"] as Record<string, boolean>;

            expect(apps["settings"]).toBe(true);
            expect(apps["viteConfig"]).toBe(true);
            expect(apps["inspector"]).toBe(false);
            expect(apps["a11y"]).toBe(false);
        });

        it("virtual options respects apps option overrides", async () => {
            expect.hasAssertions();

            const plugins = devToolbar({ apps: { inspector: true, seo: true } });
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            (main.configResolved as PluginHookFn)(buildMockResolvedConfig());

            const raw = (await (main.load as PluginHookFn).call({ addWatchFile: vi.fn() }, "\0virtual:visulima-dev-toolbar-options")) as string;

            const exported = JSON.parse(raw.replace(/^export default /, "").replace(/;$/, "")) as Record<string, unknown>;
            const apps = exported["apps"] as Record<string, boolean>;

            expect(apps["inspector"]).toBe(true);
            expect(apps["seo"]).toBe(true);

            // annotations auto-enabled when inspector is enabled
            expect(apps["annotations"]).toBe(true);
        });

        it("clamps out-of-range height/width into the 20-95 range", async () => {
            expect.hasAssertions();

            const plugins = devToolbar({ height: 5, width: 200 });
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            (main.configResolved as PluginHookFn)(buildMockResolvedConfig());

            const raw = (await (main.load as PluginHookFn).call({ addWatchFile: vi.fn() }, "\0virtual:visulima-dev-toolbar-options")) as string;

            const exported = JSON.parse(raw.replace(/^export default /, "").replace(/;$/, "")) as Record<string, unknown>;

            expect(exported["height"]).toBe(20);
            expect(exported["width"]).toBe(95);
        });

        it("falls back to defaults for non-finite height/width", async () => {
            expect.hasAssertions();

            const plugins = devToolbar({ height: Number.NaN, width: undefined });
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            (main.configResolved as PluginHookFn)(buildMockResolvedConfig());

            const raw = (await (main.load as PluginHookFn).call({ addWatchFile: vi.fn() }, "\0virtual:visulima-dev-toolbar-options")) as string;

            const exported = JSON.parse(raw.replace(/^export default /, "").replace(/;$/, "")) as Record<string, unknown>;

            expect(exported["height"]).toBe(60);
            expect(exported["width"]).toBe(80);
        });
    });

    describe("transform hook (main plugin)", () => {
        it("returns undefined when appendTo is not set", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            const result = (main.transform as PluginHookFn)("const x = 1;", "/project/src/main.ts");

            expect(result).toBeUndefined();
        });

        it("returns undefined for SSR transforms", () => {
            expect.hasAssertions();

            const plugins = devToolbar({ appendTo: "main.ts" });
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            const result = (main.transform as PluginHookFn)("const x = 1;", "/project/src/main.ts", { ssr: true });

            expect(result).toBeUndefined();
        });

        it("prepends overlay import when filename matches string appendTo", () => {
            expect.hasAssertions();

            const plugins = devToolbar({ appendTo: "router.ts" });
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            const code = "export const router = createRouter();";
            const result = (main.transform as PluginHookFn)(code, "/project/src/router.ts") as string;

            expect(result).toContain("import 'virtual:visulima-dev-toolbar-path:client/overlay.js'");
            expect(result).toContain(code);
        });

        it("prepends overlay import when filename matches RegExp appendTo", () => {
            expect.hasAssertions();

            const plugins = devToolbar({ appendTo: /router\.tsx?$/ });
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            const code = "export const router = {};";
            const result = (main.transform as PluginHookFn)(code, "/project/src/router.ts") as string;

            expect(result).toContain("import 'virtual:visulima-dev-toolbar-path:client/overlay.js'");
        });

        it("does not prepend when filename does NOT match appendTo", () => {
            expect.hasAssertions();

            const plugins = devToolbar({ appendTo: "router.ts" });
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            const result = (main.transform as PluginHookFn)("const x = 1;", "/project/src/main.ts");

            expect(result).toBeUndefined();
        });
    });

    describe("transformIndexHtml hook", () => {
        it("injects a script tag into head-prepend when appendTo is not set", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            (main.configResolved as PluginHookFn)(buildMockResolvedConfig());

            const result = (main.transformIndexHtml as PluginHookFn)() as {
                tags: { attrs: Record<string, string>; injectTo: string; tag: string }[];
            };

            expect(result).toBeDefined();
            expect(result.tags).toHaveLength(1);

            const [tag] = result.tags;

            expect(tag?.tag).toBe("script");
            expect(tag?.injectTo).toBe("head-prepend");
            expect(tag?.attrs["type"]).toBe("module");
            expect(tag?.attrs["src"]).toContain("client/overlay.js");
        });

        it("returns undefined when appendTo is set (skips HTML injection)", () => {
            expect.hasAssertions();

            const plugins = devToolbar({ appendTo: "main.ts" });
            const main = findPlugin(plugins, "@visulima/dev-toolbar");

            (main.configResolved as PluginHookFn)(buildMockResolvedConfig());

            const result = (main.transformIndexHtml as PluginHookFn)();

            expect(result).toBeUndefined();
        });

        it("uses base from resolved config in the injected script src", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const main = findPlugin(plugins, "@visulima/dev-toolbar");
            const mockConfig = buildMockResolvedConfig([], "/myapp/");

            (main.configResolved as PluginHookFn)(mockConfig);

            const result = (main.transformIndexHtml as PluginHookFn)() as {
                tags: { attrs: Record<string, string> }[];
            };

            expect(result.tags[0]?.attrs["src"]).toMatch(/^\/myapp\//);
        });
    });

    describe("remove-on-build plugin", () => {
        type ApplyFn = (cfg: unknown, env: { command: string; mode: string }) => boolean;

        it("applies when command is not serve (build mode)", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const removeOnBuild = findPlugin(plugins, "@visulima/dev-toolbar:remove-on-build");

            const applies = (removeOnBuild.apply as ApplyFn)({}, { command: "build", mode: "production" });

            expect(applies).toBe(true);
        });

        it("does not apply in serve+development mode by default", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const removeOnBuild = findPlugin(plugins, "@visulima/dev-toolbar:remove-on-build");

            const applies = (removeOnBuild.apply as ApplyFn)({}, { command: "serve", mode: "development" });

            expect(applies).toBe(false);
        });

        it("applies in serve+production mode", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const removeOnBuild = findPlugin(plugins, "@visulima/dev-toolbar:remove-on-build");

            const applies = (removeOnBuild.apply as ApplyFn)({}, { command: "serve", mode: "production" });

            expect(applies).toBe(true);
        });

        it("does not apply at all when removeDevtoolsOnBuild: false", () => {
            expect.hasAssertions();

            const plugins = devToolbar({ removeDevtoolsOnBuild: false });
            const removeOnBuild = findPlugin(plugins, "@visulima/dev-toolbar:remove-on-build");

            const applyBuild = (removeOnBuild.apply as ApplyFn)({}, { command: "build", mode: "production" });

            expect(applyBuild).toBe(false);
        });

        it("resolveId returns empty sentinel for the virtual options id", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const removeOnBuild = findPlugin(plugins, "@visulima/dev-toolbar:remove-on-build");

            const result = (removeOnBuild.resolveId as PluginHookFn)("virtual:visulima-dev-toolbar-options");

            expect(result).toBe("\0__visulima-dev-toolbar-empty");
        });

        it("resolveId returns empty sentinel for virtual path modules", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const removeOnBuild = findPlugin(plugins, "@visulima/dev-toolbar:remove-on-build");

            const result = (removeOnBuild.resolveId as PluginHookFn)("virtual:visulima-dev-toolbar-path:client/overlay.js");

            expect(result).toBe("\0__visulima-dev-toolbar-empty");
        });

        it("resolveId returns undefined for unrelated ids", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const removeOnBuild = findPlugin(plugins, "@visulima/dev-toolbar:remove-on-build");

            expect((removeOnBuild.resolveId as PluginHookFn)("react")).toBeUndefined();
        });

        it("load returns an empty default export for the empty sentinel id", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const removeOnBuild = findPlugin(plugins, "@visulima/dev-toolbar:remove-on-build");

            const result = (removeOnBuild.load as PluginHookFn)("\0__visulima-dev-toolbar-empty") as string;

            expect(result).toBe("export default {};");
        });

        it("load returns undefined for unrecognized ids", () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const removeOnBuild = findPlugin(plugins, "@visulima/dev-toolbar:remove-on-build");

            expect((removeOnBuild.load as PluginHookFn)("some-other-module")).toBeUndefined();
        });
    });

    describe("inject-source plugin", () => {
        it("returns undefined when injectSource.enabled is false", async () => {
            expect.hasAssertions();

            const plugins = devToolbar({ injectSource: { enabled: false } });
            const injectSource = findPlugin(plugins, "@visulima/dev-toolbar:inject-source");

            (findPlugin(plugins, "@visulima/dev-toolbar").configResolved as PluginHookFn)(buildMockResolvedConfig());

            const result = await (injectSource.transform as PluginHookFn)("const x = 1;", "/project/src/App.tsx");

            expect(result).toBeUndefined();
        });

        it("returns undefined for node_modules", async () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const injectSource = findPlugin(plugins, "@visulima/dev-toolbar:inject-source");

            (findPlugin(plugins, "@visulima/dev-toolbar").configResolved as PluginHookFn)(buildMockResolvedConfig());

            const result = await (injectSource.transform as PluginHookFn)("const x = 1;", "/project/node_modules/react/index.jsx");

            expect(result).toBeUndefined();
        });

        it("returns undefined for non-JSX files", async () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const injectSource = findPlugin(plugins, "@visulima/dev-toolbar:inject-source");

            (findPlugin(plugins, "@visulima/dev-toolbar").configResolved as PluginHookFn)(buildMockResolvedConfig());

            const result = await (injectSource.transform as PluginHookFn)("const x = 1;", "/project/src/utils.ts");

            expect(result).toBeUndefined();
        });

        it("returns undefined for dist/build paths", async () => {
            expect.hasAssertions();

            const plugins = devToolbar();
            const injectSource = findPlugin(plugins, "@visulima/dev-toolbar:inject-source");

            (findPlugin(plugins, "@visulima/dev-toolbar").configResolved as PluginHookFn)(buildMockResolvedConfig());

            const result = await (injectSource.transform as PluginHookFn)("const x = 1;", "/project/dist/App.jsx");

            expect(result).toBeUndefined();
        });
    });
});
