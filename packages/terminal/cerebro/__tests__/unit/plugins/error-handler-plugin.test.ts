import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { errorHandlerPlugin } from "../../../src/plugins/error-handler-plugin";
import type { Toolbox } from "../../../src/types/toolbox";

const createToolbox = (): Toolbox =>
    ({
        logger: {
            error: vi.fn(),
        },
        runtime: {
            getCwd: vi.fn(() => "/work/dir"),
        },
    }) as unknown as Toolbox;

describe(errorHandlerPlugin, () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => code as unknown as never) as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("exposes the expected plugin metadata", () => {
        expect.assertions(3);

        const plugin = errorHandlerPlugin();

        expect(plugin.name).toBe("error-handler");
        expect(plugin.version).toBe("1.0.0");
        expect(plugin.description).toContain("Enhanced error handling");

        // expectTypeOf is a compile-time assertion and does not count toward expect.assertions.
        expectTypeOf(plugin.onError).toBeFunction();
    });

    it("logs the error directly and exits by default", async () => {
        expect.assertions(2);

        const plugin = errorHandlerPlugin();
        const toolbox = createToolbox();
        const error = new Error("boom");

        await plugin.onError?.(error, toolbox);

        expect(toolbox.logger.error).toHaveBeenCalledWith(error);
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("uses a custom formatter when provided", async () => {
        expect.assertions(2);

        const formatter = vi.fn((error: Error) => `formatted:${error.message}`);
        const plugin = errorHandlerPlugin({ formatter });
        const toolbox = createToolbox();

        await plugin.onError?.(new Error("oops"), toolbox);

        expect(formatter).toHaveBeenCalledTimes(1);
        expect(toolbox.logger.error).toHaveBeenCalledWith("formatted:oops");
    });

    it("renders a detailed error using the runtime cwd when detailed is true", async () => {
        expect.assertions(2);

        const plugin = errorHandlerPlugin({ detailed: true });
        const toolbox = createToolbox();

        await plugin.onError?.(new Error("detailed boom"), toolbox);

        expect(toolbox.runtime.getCwd).toHaveBeenCalledTimes(1);
        expect(toolbox.logger.error).toHaveBeenCalledWith(expect.stringContaining("detailed boom"));
    });

    it("does not log when logErrors is false but still exits", async () => {
        expect.assertions(2);

        const plugin = errorHandlerPlugin({ logErrors: false });
        const toolbox = createToolbox();

        await plugin.onError?.(new Error("silent"), toolbox);

        expect(toolbox.logger.error).not.toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("does not exit when exitOnError is false", async () => {
        expect.assertions(2);

        const plugin = errorHandlerPlugin({ exitOnError: false });
        const toolbox = createToolbox();

        await plugin.onError?.(new Error("no exit"), toolbox);

        expect(toolbox.logger.error).toHaveBeenCalledTimes(1);
        expect(exitSpy).not.toHaveBeenCalled();
    });
});

describe("errorHandlerPlugin concise mode", () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => code as unknown as never) as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("logs only the message for an error the predicate accepts", async () => {
        expect.assertions(2);

        const plugin = errorHandlerPlugin({ concise: () => true, exitOnError: false });
        const toolbox = createToolbox();

        await plugin.onError?.(new Error("No matching projects found for: nope"), toolbox);

        // The string, not the Error — that is what drops the stack.
        expect(toolbox.logger.error).toHaveBeenCalledWith("No matching projects found for: nope");
        expect(exitSpy).not.toHaveBeenCalled();
    });

    it("logs the full error when the predicate rejects it", async () => {
        expect.assertions(1);

        const plugin = errorHandlerPlugin({ concise: () => false, exitOnError: false });
        const toolbox = createToolbox();
        const error = new Error("genuine invariant");

        await plugin.onError?.(error, toolbox);

        expect(toolbox.logger.error).toHaveBeenCalledWith(error);
    });

    it("keeps the stack in detailed mode even for a concise error", async () => {
        expect.assertions(1);

        // `--debug` has to stay diagnosable; concise must not suppress it.
        const plugin = errorHandlerPlugin({ concise: () => true, detailed: true, exitOnError: false });
        const toolbox = createToolbox();

        await plugin.onError?.(new Error("boom"), toolbox);

        expect(toolbox.logger.error).not.toHaveBeenCalledWith("boom");
    });

    it("lets an explicit formatter win over the predicate", async () => {
        expect.assertions(1);

        const plugin = errorHandlerPlugin({ concise: () => true, exitOnError: false, formatter: () => "formatted" });
        const toolbox = createToolbox();

        await plugin.onError?.(new Error("boom"), toolbox);

        expect(toolbox.logger.error).toHaveBeenCalledWith("formatted");
    });

    it("behaves as before when no predicate is given", async () => {
        expect.assertions(1);

        const plugin = errorHandlerPlugin({ exitOnError: false });
        const toolbox = createToolbox();
        const error = new Error("boom");

        await plugin.onError?.(error, toolbox);

        expect(toolbox.logger.error).toHaveBeenCalledWith(error);
    });
});
