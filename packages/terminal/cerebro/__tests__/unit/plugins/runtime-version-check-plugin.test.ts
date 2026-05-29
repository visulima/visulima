import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { runtimeVersionCheckPlugin } from "../../../src/plugins/runtime-version-check-plugin";
import type { PluginContext } from "../../../src/types/plugin";

const createContext = (): PluginContext => {
    return {
        cli: {} as PluginContext["cli"],
        cwd: "/work",
        logger: {
            debug: vi.fn(),
            error: vi.fn(),
        } as unknown as PluginContext["logger"],
    };
};

describe(runtimeVersionCheckPlugin, () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;
    const originalEnvValue = process.env.CEREBRO_MIN_NODE_VERSION;

    beforeEach(() => {
        exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => code as unknown as never) as never);
        delete process.env.CEREBRO_MIN_NODE_VERSION;
    });

    afterEach(() => {
        vi.restoreAllMocks();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        delete (globalThis as any).Bun;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        delete (globalThis as any).Deno;

        if (originalEnvValue === undefined) {
            delete process.env.CEREBRO_MIN_NODE_VERSION;
        } else {
            process.env.CEREBRO_MIN_NODE_VERSION = originalEnvValue;
        }
    });

    it("exposes the expected plugin metadata", () => {
        expect.assertions(2);

        const plugin = runtimeVersionCheckPlugin();

        expect(plugin.name).toBe("runtime-version-check");
        expect(plugin.version).toBe("1.0.0");

        // expectTypeOf is a compile-time assertion and does not count toward expect.assertions.
        expectTypeOf(plugin.init).toBeFunction();
    });

    it("passes when the current Node.js version meets the default minimum", async () => {
        expect.assertions(2);

        const context = createContext();

        await runtimeVersionCheckPlugin().init?.(context);

        expect(exitSpy).not.toHaveBeenCalled();
        expect(context.logger.debug).toHaveBeenCalledWith(expect.stringContaining("Runtime version check passed"));
    });

    it("errors and exits when the required Node.js version is higher than the current one", async () => {
        expect.assertions(2);

        const context = createContext();

        await runtimeVersionCheckPlugin({ runtimes: { node: { minVersion: 999 } } }).init?.(context);

        expect(context.logger.error).toHaveBeenCalledWith(expect.stringContaining("cerebro requires node version 999 or higher"));
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("honors the CEREBRO_MIN_NODE_VERSION env override for Node.js", async () => {
        expect.assertions(1);

        process.env.CEREBRO_MIN_NODE_VERSION = "999";

        const context = createContext();

        await runtimeVersionCheckPlugin().init?.(context);

        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("ignores a non-numeric CEREBRO_MIN_NODE_VERSION and falls back to the default", async () => {
        expect.assertions(1);

        process.env.CEREBRO_MIN_NODE_VERSION = "not-a-number";

        const context = createContext();

        await runtimeVersionCheckPlugin().init?.(context);

        // Default Node minimum (18) is satisfied by the test runtime, so no exit.
        expect(exitSpy).not.toHaveBeenCalled();
    });

    it("prefers an explicit runtime requirement over the env override", async () => {
        expect.assertions(1);

        process.env.CEREBRO_MIN_NODE_VERSION = "999";

        const context = createContext();

        // Explicit min of 1 wins over the env's 999, so the check passes.
        await runtimeVersionCheckPlugin({ runtimes: { node: { minVersion: 1 } } }).init?.(context);

        expect(exitSpy).not.toHaveBeenCalled();
    });

    it("detects Bun and validates against the bun default minimum", async () => {
        expect.assertions(1);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (globalThis as any).Bun = { process: { env: {}, exit: vi.fn() }, version: "1.0.0" };

        const context = createContext();

        await runtimeVersionCheckPlugin().init?.(context);

        expect(exitSpy).not.toHaveBeenCalled();
    });

    it("detects Bun with a missing version and exits when below the requirement", () => {
        expect.assertions(3);

        const bunExit = vi.fn();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (globalThis as any).Bun = { process: { env: {}, exit: bunExit } };

        const context = createContext();

        // The runtime-process Bun exit wrapper throws after calling exit because
        // the mocked exit returns instead of terminating the process.
        expect(() => runtimeVersionCheckPlugin({ runtimes: { bun: { minVersion: 1 } } }).init?.(context)).toThrow("Bun exit failed");

        expect(context.logger.error).toHaveBeenCalledWith(expect.stringContaining("cerebro requires bun"));
        expect(bunExit).toHaveBeenCalledWith(1);
    });

    it("detects Deno and validates against the provided deno requirement", async () => {
        expect.assertions(1);

        const denoExit = vi.fn();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (globalThis as any).Deno = {
            env: { get: () => undefined, has: () => false, set: () => {}, toObject: () => {
                return {};
            } },
            exit: denoExit,
            version: { deno: "2.1.0" },
        };

        const context = createContext();

        await runtimeVersionCheckPlugin({ runtimes: { deno: { minVersion: 1 } } }).init?.(context);

        expect(denoExit).not.toHaveBeenCalled();
    });

    it("detects Deno with a missing version object and exits when below the requirement", () => {
        expect.assertions(2);

        const denoExit = vi.fn();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (globalThis as any).Deno = {
            env: { get: () => undefined, has: () => false, set: () => {}, toObject: () => {
                return {};
            } },
            exit: denoExit,
        };

        const context = createContext();

        // The runtime-process Deno exit wrapper throws after calling exit because
        // the mocked exit returns instead of terminating the process.
        expect(() => runtimeVersionCheckPlugin({ runtimes: { deno: { minVersion: 5 } } }).init?.(context)).toThrow("Deno exit failed");

        expect(denoExit).toHaveBeenCalledWith(1);
    });
});
