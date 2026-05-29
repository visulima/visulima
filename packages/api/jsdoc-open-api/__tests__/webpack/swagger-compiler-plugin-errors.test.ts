import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { exitMock } = vi.hoisted(() => {
    return {
        exitMock: vi.fn<(code?: number) => never>(),
    };
});

vi.mock(import("node:process"), async () => {
    return {
        ...await vi.importActual<typeof import("node:process")>("node:process"),
        exit: exitMock,
    };
});

// eslint-disable-next-line import/first
import SwaggerCompilerPlugin from "../../src/webpack/swagger-compiler-plugin";

type TapAsyncCallback = (compilation: unknown, callback: () => void) => Promise<void> | void;

interface FakeCompiler {
    hooks: {
        make: {
            run: () => Promise<void>;
            tapAsync: (name: string, callback: TapAsyncCallback) => void;
        };
    };
}

const createFakeCompiler = (): FakeCompiler => {
    let registered: TapAsyncCallback | undefined;

    return {
        hooks: {
            make: {
                run: async () => {
                    const callback = registered;

                    if (!callback) {
                        throw new Error("tapAsync was never called");
                    }

                    await new Promise<void>((resolve, reject) => {
                        try {
                            const maybePromise = callback({}, () => { resolve(); });

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
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        workDirectory = mkdtempSync(join(tmpdir(), "swagger-plugin-error-"));
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        exitMock.mockReset();
    });

    afterEach(() => {
        rmSync(workDirectory, { force: true, recursive: true });
        vi.restoreAllMocks();
    });

    it("logs the error and exits when a source file cannot be parsed", async () => {
        expect.assertions(2);

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

        plugin.apply(compiler as unknown as Parameters<SwaggerCompilerPlugin["apply"]>[0]);

        await compiler.hooks.make.run();

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
        expect(exitMock).toHaveBeenCalledWith(1);
    });

    it("invokes the error handler and exits when the output directory cannot be created", async () => {
        expect.assertions(2);

        // Make the parent of the asset path a regular file so `mkdir` (recursive) fails.
        const blocker = join(workDirectory, "blocker");

        writeFileSync(blocker, "i am a file, not a directory");

        const assetsPath = join(blocker, "swagger.json");

        const plugin = new SwaggerCompilerPlugin(assetsPath, [workDirectory], baseDefinition, {});

        const compiler = createFakeCompiler();

        plugin.apply(compiler as unknown as Parameters<SwaggerCompilerPlugin["apply"]>[0]);

        await compiler.hooks.make.run();

        // Allow the async mkdir/writeFile callbacks to flush.
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 50);
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
        expect(exitMock).toHaveBeenCalledWith(1);
    });
});
