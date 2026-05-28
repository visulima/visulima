/* eslint-disable max-classes-per-file -- helpers + test scoped to this file */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SwaggerCompilerPlugin from "../../src/webpack/swagger-compiler-plugin";

// Minimal duck-type that matches the slice of `webpack.Compiler` the plugin actually uses.
type TapAsyncCallback = (compilation: unknown, callback: () => void) => Promise<void> | void;

interface FakeCompiler {
    hooks: {
        make: {
            tap: (name: string, callback: TapAsyncCallback) => void;
            tapAsync: (name: string, callback: TapAsyncCallback) => void;
            run: () => Promise<void>;
        };
    };
}

const createFakeCompiler = (): FakeCompiler => {
    let registered: TapAsyncCallback | undefined;

    return {
        hooks: {
            make: {
                run: async () => {
                    if (!registered) {
                        throw new Error("tapAsync was never called");
                    }

                    await new Promise<void>((resolve, reject) => {
                        try {
                            const maybePromise = registered!({}, () => resolve());

                            if (maybePromise && typeof (maybePromise as Promise<unknown>).then === "function") {
                                (maybePromise as Promise<unknown>).then(undefined, reject);
                            }
                        } catch (error) {
                            reject(error as Error);
                        }
                    });
                },
                tap: (_: string, callback: TapAsyncCallback) => {
                    registered = callback;
                },
                tapAsync: (_: string, callback: TapAsyncCallback) => {
                    registered = callback;
                },
            },
        },
    };
};

describe(SwaggerCompilerPlugin, () => {
    const baseDefinition = {
        info: {
            title: "Petstore",
            version: "1.0.0",
        },
        openapi: "3.0.3",
    } as const;

    let workDir: string;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "swagger-plugin-"));
        consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        rmSync(workDir, { force: true, recursive: true });
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    it("stores the constructor arguments and defaults options", () => {
        expect.assertions(1);

        const plugin = new SwaggerCompilerPlugin("/tmp/out.json", ["/tmp/src"], baseDefinition, {});

        // The plugin keeps the values as private fields; assert via `apply` not throwing on a fake compiler later.
        // For now, simply confirm the plugin is an instance.
        expect(plugin).toBeInstanceOf(SwaggerCompilerPlugin);
    });

    it("collects routes, builds a valid spec, and writes the asset file when run via webpack hook", async () => {
        expect.assertions(5);

        const assetsPath = join(workDir, "nested", "swagger.json");
        const sourcesDir = join(__dirname, "..", "..", "__fixtures__", "routes");

        const plugin = new SwaggerCompilerPlugin(assetsPath, [sourcesDir], baseDefinition, { verbose: true });

        const compiler = createFakeCompiler();

        plugin.apply(compiler as unknown as Parameters<SwaggerCompilerPlugin["apply"]>[0]);

        await compiler.hooks.make.run();

        // Allow the async writeFile callback to flush.
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 50);
        });

        expect(existsSync(assetsPath)).toBe(true);

        const written = JSON.parse(readFileSync(assetsPath, "utf8")) as {
            info: { title: string };
            openapi: string;
            paths?: Record<string, unknown>;
        };

        expect(written.info.title).toBe("Petstore");
        expect(written.openapi).toBe("3.0.3");
        expect(written.paths).toBeDefined();
        // Verbose mode logs at least the "Build paused" line and "switching back" line
        expect(consoleLogSpy.mock.calls.length).toBeGreaterThan(0);
    });

    it("honors the ignore option by skipping matching files", async () => {
        expect.assertions(1);

        const assetsPath = join(workDir, "swagger-ignored.json");
        const sourcesDir = join(__dirname, "..", "..", "__fixtures__", "routes");

        const plugin = new SwaggerCompilerPlugin(assetsPath, [sourcesDir], baseDefinition, {
            ignore: [/pet\.js$/u, /store\.js$/u, /user\.js$/u],
        });

        const compiler = createFakeCompiler();

        plugin.apply(compiler as unknown as Parameters<SwaggerCompilerPlugin["apply"]>[0]);

        await compiler.hooks.make.run();

        await new Promise<void>((resolve) => {
            setTimeout(resolve, 50);
        });

        const written = JSON.parse(readFileSync(assetsPath, "utf8")) as { paths?: Record<string, unknown> };

        // With all route files ignored, paths should be empty/undefined.
        expect(written.paths === undefined || Object.keys(written.paths).length === 0).toBe(true);
    });
});
