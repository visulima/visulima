import { beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";

import { loadNativeBindings } from "../src/native-binding";

describe("native-binding", () => {
    describe(loadNativeBindings, () => {
        it("should return the native bindings when addon is available", async () => {
            expect.assertions(2);

            vi.resetModules();
            const { loadNativeBindings } = await import("../src/native-binding");
            const result = loadNativeBindings();

            expect(result).toBeDefined();

            expectTypeOf(result).toBeObject();
        });

        it("should cache the result after the first attempt", async () => {
            expect.assertions(1);

            vi.resetModules();
            const { loadNativeBindings } = await import("../src/native-binding");
            const first = loadNativeBindings();
            const second = loadNativeBindings();

            expect(first).toBe(second);
        });
    });

    describe("isNativeAvailable", () => {
        it("should return a boolean", async () => {
            expect.assertions(1);

            vi.resetModules();
            const { isNativeAvailable } = await import("../src/native-binding");

            const result = isNativeAvailable();

            expectTypeOf(result).toBeBoolean();

            expect(typeof result === "boolean").toBe(true);
        });
    });
});

// Native addon integration tests - only run if addon is compiled
describe("native addon integration", () => {
    let native: Awaited<ReturnType<typeof loadNativeBindings>>;

    beforeAll(async () => {
        vi.resetModules();
        const { loadNativeBindings } = await import("../src/native-binding");

        native = loadNativeBindings();
    });

    describe("nATIVE_BINDING_VERSION", () => {
        it("should export NATIVE_BINDING_VERSION as a number", () => {
            // expectTypeOf is a compile-time check and does not count toward assertions.
            expect.assertions(1);

            expect(native!.NATIVE_BINDING_VERSION).toBeDefined();

            expectTypeOf(native!.NATIVE_BINDING_VERSION).toBeNumber();
        });

        it("should match the expected ABI version in native-binding.ts", () => {
            expect.assertions(1);

            // If this fails, bump EXPECTED_NATIVE_BINDING_VERSION in
            // src/native-binding.ts and NATIVE_BINDING_VERSION in
            // native/src/lib.rs together.
            expect(native!.NATIVE_BINDING_VERSION).toBe(1);
        });
    });

    describe("detectPackageManager", () => {
        it("should detect a package manager in the workspace root", () => {
            // expectTypeOf is a compile-time check and does not count toward assertions.
            expect.assertions(1);

            const result = native!.detectPackageManager(process.cwd());

            expectTypeOf(result.name).toBeString();

            expect(["pnpm", "npm", "yarn", "bun"]).toContain(result.name);

            expectTypeOf(result.isWorkspace).toBeBoolean();
        });

        it("should return pnpm for this monorepo", () => {
            expect.assertions(1);

            const result = native!.detectPackageManager(process.cwd());

            expect(result.name).toBe("pnpm");
        });
    });

    describe("resolveInstall", () => {
        it("should resolve pnpm install with frozen lockfile", () => {
            expect.assertions(2);

            const result = native!.resolveInstall("pnpm", "10.0.0", {
                dev: false,
                filter: [],
                force: false,
                frozenLockfile: true,
                ignoreScripts: false,
                lockfileOnly: false,
                noOptional: false,
                offline: false,
                prod: false,
                recursive: false,
                silent: false,
                workspaceRoot: false,
            });

            expect(result.bin).toBe("pnpm");
            expect(result.args).toStrictEqual(["install", "--frozen-lockfile"]);
        });

        it("should resolve npm ci for frozen lockfile", () => {
            expect.assertions(2);

            const result = native!.resolveInstall("npm", "11.0.0", {
                dev: false,
                filter: [],
                force: false,
                frozenLockfile: true,
                ignoreScripts: false,
                lockfileOnly: false,
                noOptional: false,
                offline: false,
                prod: false,
                recursive: false,
                silent: false,
                workspaceRoot: false,
            });

            expect(result.bin).toBe("npm");
            expect(result.args[0]).toBe("ci");
        });

        it("should resolve yarn berry --immutable for frozen lockfile", () => {
            expect.assertions(2);

            const result = native!.resolveInstall("yarn", "4.0.0", {
                dev: false,
                filter: [],
                force: false,
                frozenLockfile: true,
                ignoreScripts: false,
                lockfileOnly: false,
                noOptional: false,
                offline: false,
                prod: false,
                recursive: false,
                silent: false,
                workspaceRoot: false,
            });

            expect(result.bin).toBe("yarn");
            expect(result.args).toContain("--immutable");
        });

        it("should resolve bun install with frozen lockfile", () => {
            expect.assertions(2);

            const result = native!.resolveInstall("bun", "1.0.0", {
                dev: false,
                filter: [],
                force: false,
                frozenLockfile: true,
                ignoreScripts: false,
                lockfileOnly: false,
                noOptional: false,
                offline: false,
                prod: false,
                recursive: false,
                silent: false,
                workspaceRoot: false,
            });

            expect(result.bin).toBe("bun");
            expect(result.args).toContain("--frozen-lockfile");
        });
    });

    describe("resolveAdd", () => {
        it("should resolve pnpm add with -D flag", () => {
            expect.assertions(3);

            const result = native!.resolveAdd("pnpm", "10.0.0", {
                exact: false,
                filter: [],
                global: false,
                optional: false,
                packages: ["react"],
                peer: false,
                saveDev: true,
                workspace: false,
                workspaceRoot: false,
            });

            expect(result.bin).toBe("pnpm");
            expect(result.args).toContain("add");
            expect(result.args).toContain("-D");
        });

        it("should place pnpm --filter before add", () => {
            expect.assertions(2);

            const result = native!.resolveAdd("pnpm", "10.0.0", {
                exact: false,
                filter: ["app"],
                global: false,
                optional: false,
                packages: ["react"],
                peer: false,
                saveDev: false,
                workspace: false,
                workspaceRoot: false,
            });

            const filterIndex = result.args.indexOf("--filter");
            const addIndex = result.args.indexOf("add");

            expect(filterIndex).toBeGreaterThanOrEqual(0);
            expect(filterIndex).toBeLessThan(addIndex);
        });

        it("should use npm for global installs regardless of PM", () => {
            expect.assertions(2);

            const result = native!.resolveAdd("pnpm", "10.0.0", {
                exact: false,
                filter: [],
                global: true,
                optional: false,
                packages: ["typescript"],
                peer: false,
                saveDev: false,
                workspace: false,
                workspaceRoot: false,
            });

            expect(result.bin).toBe("npm");
            expect(result.args).toContain("--global");
        });

        it("should use bun for global installs on bun projects", () => {
            expect.assertions(2);

            const result = native!.resolveAdd("bun", "1.0.0", {
                exact: false,
                filter: [],
                global: true,
                optional: false,
                packages: ["typescript"],
                peer: false,
                saveDev: false,
                workspace: false,
                workspaceRoot: false,
            });

            expect(result.bin).toBe("bun");
            expect(result.args).toContain("--global");
        });
    });

    describe("resolveRemove", () => {
        it("should resolve npm uninstall", () => {
            expect.assertions(2);

            const result = native!.resolveRemove("npm", "11.0.0", {
                filter: [],
                global: false,
                packages: ["lodash"],
                recursive: false,
                saveDev: false,
                workspaceRoot: false,
            });

            expect(result.bin).toBe("npm");
            expect(result.args).toStrictEqual(["uninstall", "lodash"]);
        });

        it("should use npm for global removal", () => {
            expect.assertions(1);

            const result = native!.resolveRemove("yarn", "4.0.0", {
                filter: [],
                global: true,
                packages: ["typescript"],
                recursive: false,
                saveDev: false,
                workspaceRoot: false,
            });

            expect(result.bin).toBe("npm");
        });
    });

    describe("resolveDedupe", () => {
        it("should resolve pnpm dedupe --check", () => {
            expect.assertions(2);

            const result = native!.resolveDedupe("pnpm", "10.0.0", true);

            expect(result.bin).toBe("pnpm");
            expect(result.args).toStrictEqual(["dedupe", "--check"]);
        });

        it("should resolve npm dedupe --dry-run", () => {
            expect.assertions(2);

            const result = native!.resolveDedupe("npm", "11.0.0", true);

            expect(result.bin).toBe("npm");
            expect(result.args).toStrictEqual(["dedupe", "--dry-run"]);
        });

        it("should warn for yarn v1", () => {
            expect.assertions(1);

            const result = native!.resolveDedupe("yarn", "1.22.0", false);

            expect(result.warnings.length).toBeGreaterThan(0);
        });

        it("should warn for bun", () => {
            expect.assertions(1);

            const result = native!.resolveDedupe("bun", "1.0.0", false);

            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });

    describe("resolveWhy", () => {
        it("should resolve pnpm why with --json", () => {
            expect.assertions(2);

            const result = native!.resolveWhy("pnpm", "10.0.0", {
                depth: undefined,
                dev: false,
                filter: [],
                global: false,
                json: true,
                long: false,
                noOptional: false,
                packages: ["react"],
                parseable: false,
                prod: false,
                recursive: false,
            });

            expect(result.args).toContain("why");
            expect(result.args).toContain("--json");
        });

        it("should resolve npm explain", () => {
            expect.assertions(1);

            const result = native!.resolveWhy("npm", "11.0.0", {
                depth: undefined,
                dev: false,
                filter: [],
                global: false,
                json: false,
                long: false,
                noOptional: false,
                packages: ["react"],
                parseable: false,
                prod: false,
                recursive: false,
            });

            expect(result.args[0]).toBe("explain");
        });

        it("should handle depth option", () => {
            expect.assertions(1);

            const result = native!.resolveWhy("pnpm", "10.0.0", {
                depth: 3,
                dev: false,
                filter: [],
                global: false,
                json: false,
                long: false,
                noOptional: false,
                packages: ["react"],
                parseable: false,
                prod: false,
                recursive: false,
            });

            expect(result.args).toContain("--depth");
        });

        it("should handle undefined depth without error", () => {
            expect.assertions(1);

            const result = native!.resolveWhy("pnpm", "10.0.0", {
                depth: undefined,
                dev: false,
                filter: [],
                global: false,
                json: false,
                long: false,
                noOptional: false,
                packages: ["react"],
                parseable: false,
                prod: false,
                recursive: false,
            });

            expect(result.args).not.toContain("--depth");
        });
    });

    describe("resolveDlx", () => {
        it("should resolve pnpm dlx", () => {
            expect.assertions(2);

            const result = native!.resolveDlx("pnpm", "10.0.0", {
                additionalPackages: [],
                args: ["my-app"],
                package: "create-vite",
                shellMode: false,
                silent: false,
            });

            expect(result.bin).toBe("pnpm");
            expect(result.args).toStrictEqual(["dlx", "create-vite", "my-app"]);
        });

        it("should resolve bun x", () => {
            expect.assertions(2);

            const result = native!.resolveDlx("bun", "1.0.0", {
                additionalPackages: [],
                args: ["my-app"],
                package: "create-vite",
                shellMode: false,
                silent: false,
            });

            expect(result.bin).toBe("bun");
            expect(result.args[0]).toBe("x");
        });

        it("should fall back to npx for yarn v1", () => {
            expect.assertions(2);

            const result = native!.resolveDlx("yarn", "1.22.0", {
                additionalPackages: [],
                args: [],
                package: "create-vite",
                shellMode: false,
                silent: false,
            });

            expect(result.bin).toBe("npx");
            expect(result.warnings.length).toBeGreaterThan(0);
        });

        it("should resolve npm exec with --yes", () => {
            expect.assertions(2);

            const result = native!.resolveDlx("npm", "11.0.0", {
                additionalPackages: [],
                args: [],
                package: "create-vite",
                shellMode: false,
                silent: false,
            });

            expect(result.bin).toBe("npm");
            expect(result.args).toContain("--yes");
        });
    });

    describe("resolveExec", () => {
        it("should resolve pnpm exec", () => {
            expect.assertions(2);

            const result = native!.resolveExec("pnpm", "10.0.0", {
                args: ["."],
                command: "eslint",
                filter: [],
                parallel: false,
                recursive: false,
                reverse: false,
                shellMode: false,
                workspaceRoot: false,
            });

            expect(result.bin).toBe("pnpm");
            expect(result.args).toContain("exec");
        });

        it("should resolve npm exec with --", () => {
            expect.assertions(1);

            const result = native!.resolveExec("npm", "11.0.0", {
                args: ["."],
                command: "eslint",
                filter: [],
                parallel: false,
                recursive: false,
                reverse: false,
                shellMode: false,
                workspaceRoot: false,
            });

            expect(result.args).toContain("--");
        });

        it("should fall back to npx for yarn v1", () => {
            expect.assertions(1);

            const result = native!.resolveExec("yarn", "1.22.0", {
                args: [],
                command: "eslint",
                filter: [],
                parallel: false,
                recursive: false,
                reverse: false,
                shellMode: false,
                workspaceRoot: false,
            });

            expect(result.bin).toBe("npx");
        });

        it("should use bunx for bun", () => {
            expect.assertions(1);

            const result = native!.resolveExec("bun", "1.0.0", {
                args: [],
                command: "eslint",
                filter: [],
                parallel: false,
                recursive: false,
                reverse: false,
                shellMode: false,
                workspaceRoot: false,
            });

            expect(result.bin).toBe("bunx");
        });
    });

    describe("resolveOutdated", () => {
        it("should resolve pnpm outdated with --format json", () => {
            expect.assertions(2);

            const result = native!.resolveOutdated("pnpm", "10.0.0", {
                compatible: false,
                dev: false,
                filter: [],
                format: "json",
                global: false,
                long: false,
                noOptional: false,
                packages: [],
                prod: false,
                recursive: false,
                workspaceRoot: false,
            });

            expect(result.bin).toBe("pnpm");
            expect(result.args).toContain("json");
        });

        it("should warn about yarn berry upgrade-interactive", () => {
            expect.assertions(1);

            const result = native!.resolveOutdated("yarn", "4.0.0", {
                compatible: false,
                dev: false,
                filter: [],
                format: "table",
                global: false,
                long: false,
                noOptional: false,
                packages: [],
                prod: false,
                recursive: false,
                workspaceRoot: false,
            });

            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });

    describe("resolvePmCommand", () => {
        it("should map pnpm cache dir to store path", () => {
            expect.assertions(2);

            const result = native!.resolvePmCommand("pnpm", "10.0.0", "cache", ["dir"]);

            expect(result.bin).toBe("pnpm");
            expect(result.args).toStrictEqual(["store", "path"]);
        });

        it("should delegate npm-only commands to npm", () => {
            expect.assertions(2);

            const result = native!.resolvePmCommand("pnpm", "10.0.0", "token", ["list"]);

            expect(result.bin).toBe("npm");
            expect(result.warnings.length).toBeGreaterThan(0);
        });

        it("should use bun pm ls for list", () => {
            expect.assertions(1);

            const result = native!.resolvePmCommand("bun", "1.0.0", "list", []);

            expect(result.args).toStrictEqual(["pm", "ls"]);
        });

        it("should resolve view to `npm view` for npm", () => {
            expect.assertions(2);

            const result = native!.resolvePmCommand("npm", "10.0.0", "view", ["react", "version"]);

            expect(result.bin).toBe("npm");
            expect(result.args).toStrictEqual(["view", "react", "version"]);
        });

        it("should resolve view to `pnpm view` for pnpm", () => {
            expect.assertions(2);

            const result = native!.resolvePmCommand("pnpm", "10.0.0", "view", ["react"]);

            expect(result.bin).toBe("pnpm");
            expect(result.args).toStrictEqual(["view", "react"]);
        });

        it("should resolve view to `yarn info` for yarn v1", () => {
            expect.assertions(2);

            const result = native!.resolvePmCommand("yarn", "1.22.19", "view", ["react"]);

            expect(result.bin).toBe("yarn");
            expect(result.args).toStrictEqual(["info", "react"]);
        });

        it("should resolve view to `yarn npm info` for yarn berry", () => {
            expect.assertions(2);

            const result = native!.resolvePmCommand("yarn", "4.1.0", "view", ["react"]);

            expect(result.bin).toBe("yarn");
            expect(result.args).toStrictEqual(["npm", "info", "react"]);
        });

        it("should resolve view to `bun pm view` (not `bun view`) for bun", () => {
            expect.assertions(2);

            const result = native!.resolvePmCommand("bun", "1.3.0", "view", ["react"]);

            expect(result.bin).toBe("bun");
            expect(result.args).toStrictEqual(["pm", "view", "react"]);
        });

        it("should treat `info` as an alias of `view`", () => {
            expect.assertions(2);

            const viewResult = native!.resolvePmCommand("bun", "1.3.0", "view", ["react"]);
            const infoResult = native!.resolvePmCommand("bun", "1.3.0", "info", ["react"]);

            expect(infoResult.bin).toBe(viewResult.bin);
            expect(infoResult.args).toStrictEqual(viewResult.args);
        });
    });

    describe("resolveLink / resolveUnlink", () => {
        it("should resolve link with target", () => {
            expect.assertions(1);

            const result = native!.resolveLink("pnpm", "10.0.0", "./local-pkg");

            expect(result.args).toStrictEqual(["link", "./local-pkg"]);
        });

        it("should resolve link without target", () => {
            expect.assertions(1);

            const result = native!.resolveLink("npm", "11.0.0", null);

            expect(result.args).toStrictEqual(["link"]);
        });

        it("should not warn on pnpm v10 link with bare name", () => {
            expect.assertions(2);

            const result = native!.resolveLink("pnpm", "10.0.0", "react");

            expect(result.args).toStrictEqual(["link", "react"]);
            expect(result.warnings).toHaveLength(0);
        });

        it("should warn about arg-less link on pnpm v11", () => {
            expect.assertions(2);

            const result = native!.resolveLink("pnpm", "11.0.0-rc.0", null);

            expect(result.args).toStrictEqual(["link"]);
            expect(result.warnings.some((w) => w.includes("arg-less") && w.includes("v11"))).toBe(true);
        });

        it("should warn about bare package name on pnpm v11", () => {
            expect.assertions(2);

            const result = native!.resolveLink("pnpm", "11.0.0", "react");

            expect(result.args).toStrictEqual(["link", "react"]);
            expect(result.warnings.some((w) => w.includes("global-store") || w.includes("path"))).toBe(true);
        });

        it("should not warn about path target on pnpm v11", () => {
            expect.assertions(2);

            const result = native!.resolveLink("pnpm", "11.0.0", "./local-pkg");

            expect(result.args).toStrictEqual(["link", "./local-pkg"]);
            expect(result.warnings).toHaveLength(0);
        });

        it("should not warn on pnpm v11 for absolute path", () => {
            expect.assertions(1);

            const result = native!.resolveLink("pnpm", "11.0.0", "/home/user/pkg");

            expect(result.warnings).toHaveLength(0);
        });

        it("should warn generically for unknown pnpm version with bare name", () => {
            expect.assertions(2);

            const result = native!.resolveLink("pnpm", "latest", "react");

            expect(result.args).toStrictEqual(["link", "react"]);
            expect(result.warnings.some((w) => w.includes("unknown") && w.includes("v11"))).toBe(true);
        });

        it("should warn generically for unknown pnpm version with no target", () => {
            expect.assertions(2);

            const result = native!.resolveLink("pnpm", "latest", null);

            expect(result.args).toStrictEqual(["link"]);
            expect(result.warnings.some((w) => w.includes("unknown") && w.includes("Arg-less"))).toBe(true);
        });

        it("should not warn for unknown pnpm version with path target", () => {
            expect.assertions(1);

            const result = native!.resolveLink("pnpm", "latest", "./local-pkg");

            expect(result.warnings).toHaveLength(0);
        });

        it("should resolve unlink with recursive", () => {
            expect.assertions(1);

            const result = native!.resolveUnlink("pnpm", "10.0.0", ["react"], true);

            expect(result.args).toContain("--recursive");
        });

        it("should warn about recursive unlink on npm", () => {
            expect.assertions(1);

            const result = native!.resolveUnlink("npm", "11.0.0", [], true);

            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });

    describe("execPmCommand", () => {
        it("should execute allowed binaries", () => {
            expect.assertions(2);

            const result = native!.execPmCommand("echo", ["hello"], process.cwd());

            expect(result.code).toBe(0);
            expect(result.stdout.trim()).toBe("hello");
        });

        it("should block disallowed binaries", () => {
            // The Rust side now validates the binary allow-list before spawning and
            // throws a JS error, rather than returning exit 126 with stderr text.
            expect.assertions(1);

            expect(() => native!.execPmCommand("/bin/bash", ["-c", "echo hacked"], process.cwd())).toThrow(/Disallowed binary/);
        });
    });

    describe("whichBin", () => {
        it("should find node", () => {
            expect.assertions(1);

            const result = native!.whichBin("node");

            expect(result).toContain("node");
        });

        it("should return null for nonexistent binary", () => {
            expect.assertions(1);

            const result = native!.whichBin("definitely-not-a-real-binary-xyz");

            expect(result).toBeNull();
        });
    });
});
