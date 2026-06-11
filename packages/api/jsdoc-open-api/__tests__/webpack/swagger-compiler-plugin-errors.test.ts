import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SwaggerCompilerPlugin from "../../src/webpack/swagger-compiler-plugin";

type TapAsyncCallback = (compilation: unknown, callback: (error?: Error) => void) => Promise<void> | void;

interface FakeCompiler {
    hooks: {
        make: {
            run: (compilation: { errors: Error[] }) => Promise<Error | undefined>;
            tapAsync: (name: string, callback: TapAsyncCallback) => void;
        };
    };
}

const createFakeCompiler = (): FakeCompiler => {
    let registered: TapAsyncCallback | undefined;

    return {
        hooks: {
            make: {
                // Resolves with the error passed to `callback`, mirroring how webpack
                // surfaces async plugin failures (never via `process.exit`).
                run: async (compilation: { errors: Error[] }) => {
                    const callback = registered;

                    if (!callback) {
                        throw new Error("tapAsync was never called");
                    }

                    return await new Promise<Error | undefined>((resolve, reject) => {
                        try {
                            const maybePromise = callback(compilation, (error?: Error) => {
                                resolve(error);
                            });

                            if (maybePromise && typeof (maybePromise as Promise<unknown>).then === "function") {
                                (maybePromise as Promise<unknown>).catch((error: unknown) => {
                                    reject(error instanceof Error ? error : new Error(String(error)));
                                });
                            }
                        } catch (error) {
                            reject(error instanceof Error ? error : new Error(String(error)));
                        }
                    });
                },
                tapAsync: (_: string, callback: TapAsyncCallback) => {
                    registered = callback;
                },
            },
        },
    };
};

const baseDefinition = {
    info: { title: "Petstore", version: "1.0.0" },
    openapi: "3.0.3",
} as const;

describe("swaggerCompilerPlugin error handling", () => {
    let workDirectory: string;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        workDirectory = mkdtempSync(join(tmpdir(), "swagger-plugin-error-"));
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        // Guard against any accidental hard exit — the plugin must never call it.
        exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    });

    afterEach(() => {
        rmSync(workDirectory, { force: true, recursive: true });
        vi.restoreAllMocks();
    });

    it("pushes the parse error onto compilation.errors and reports it via the callback instead of exiting", async () => {
        expect.assertions(3);

        const sourceFile = join(workDirectory, "broken.js");

        // Malformed YAML inside a @swagger comment makes parseFile throw.
        writeFileSync(
            sourceFile,
            `/**
 * @swagger /pets:
 *   get:
 *  bad: indentation: here
 */
`,
        );

        const plugin = new SwaggerCompilerPlugin(join(workDirectory, "swagger.json"), [workDirectory], baseDefinition, {});

        const compiler = createFakeCompiler();
        const compilation = { errors: [] as Error[] };

        plugin.apply(compiler as unknown as Parameters<SwaggerCompilerPlugin["apply"]>[0]);

        const reported = await compiler.hooks.make.run(compilation);

        expect(reported).toBeInstanceOf(Error);
        expect(compilation.errors).toHaveLength(1);
        expect(exitSpy).not.toHaveBeenCalled();
    });

    it("reports a write failure via the callback instead of exiting", async () => {
        expect.assertions(2);

        // Make the parent of the asset path a regular file so `mkdir` (recursive) fails.
        const blocker = join(workDirectory, "blocker");

        writeFileSync(blocker, "i am a file, not a directory");

        const assetsPath = join(blocker, "swagger.json");

        const plugin = new SwaggerCompilerPlugin(assetsPath, [workDirectory], baseDefinition, {});

        const compiler = createFakeCompiler();
        const compilation = { errors: [] as Error[] };

        plugin.apply(compiler as unknown as Parameters<SwaggerCompilerPlugin["apply"]>[0]);

        const reported = await compiler.hooks.make.run(compilation);

        expect(reported).toBeInstanceOf(Error);
        expect(exitSpy).not.toHaveBeenCalled();
    });

    it("suppresses informational logs when silent is set", async () => {
        expect.assertions(1);

        const consoleLogSpy = vi.spyOn(console, "log");

        const plugin = new SwaggerCompilerPlugin(join(workDirectory, "swagger.json"), [workDirectory], baseDefinition, { silent: true });

        const compiler = createFakeCompiler();
        const compilation = { errors: [] as Error[] };

        plugin.apply(compiler as unknown as Parameters<SwaggerCompilerPlugin["apply"]>[0]);

        await compiler.hooks.make.run(compilation);

        const messages = consoleLogSpy.mock.calls.map((call) => call[0]);

        expect(messages).not.toContain("Build paused, switching to swagger build");
    });
});
