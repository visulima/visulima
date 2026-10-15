import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
    exitProcess,
    getArch,
    getArgv,
    getCwd,
    getEnv,
    getExecArgv,
    getExecPath,
    getPlatform,
    getVersions,
    onProcessEvent,
} from "../../../../src/util/general/runtime-process";

describe("runtime-process (Node.js)", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe(getArgv, () => {
        it("returns process.argv on Node.js", () => {
            expect.assertions(1);

            const argv = getArgv();

            expect(argv).toStrictEqual(process.argv);
        });
    });

    describe(getCwd, () => {
        it("returns process.cwd() on Node.js", () => {
            expect.assertions(1);

            expect(getCwd()).toBe(process.cwd());
        });
    });

    describe(getEnv, () => {
        it("returns process.env on Node.js", () => {
            expect.assertions(1);

            expect(getEnv()).toBe(process.env);
        });
    });

    describe(getExecArgv, () => {
        it("returns process.execArgv on Node.js", () => {
            expect.assertions(1);

            expect(getExecArgv()).toStrictEqual(process.execArgv);
        });
    });

    describe(getExecPath, () => {
        it("returns process.execPath on Node.js", () => {
            expect.assertions(1);

            expect(getExecPath()).toBe(process.execPath);
        });
    });

    describe(getPlatform, () => {
        it("returns process.platform on Node.js", () => {
            expect.assertions(1);

            expect(getPlatform()).toBe(process.platform);
        });
    });

    describe(getArch, () => {
        it("returns process.arch on Node.js", () => {
            expect.assertions(1);

            expect(getArch()).toBe(process.arch);
        });
    });

    describe(getVersions, () => {
        it("returns process.versions on Node.js", () => {
            expect.assertions(1);

            expect(getVersions()).toBe(process.versions);
        });
    });

    describe(exitProcess, () => {
        it("calls process.exit with the provided code", () => {
            expect.assertions(2);

            const spy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => code as unknown as never) as never);

            exitProcess(2);

            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(2);
        });

        it("defaults to exit code 0", () => {
            expect.assertions(1);

            const spy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => code as unknown as never) as never);

            exitProcess();

            expect(spy).toHaveBeenCalledWith(0);
        });
    });

    describe(onProcessEvent, () => {
        it("registers an uncaughtException handler and returns a cleanup fn that removes it", () => {
            expect.assertions(2);

            const handler = vi.fn();
            const onSpy = vi.spyOn(process, "on");
            const offSpy = vi.spyOn(process, "removeListener");

            const cleanup = onProcessEvent("uncaughtException", handler);

            expect(onSpy).toHaveBeenCalledWith("uncaughtException", handler);

            cleanup();

            expect(offSpy).toHaveBeenCalledWith("uncaughtException", handler);

            expectTypeOf(cleanup).toBeFunction();
        });

        it("registers an unhandledRejection handler", () => {
            expect.assertions(1);

            const handler = vi.fn();
            const onSpy = vi.spyOn(process, "on");

            const cleanup = onProcessEvent("unhandledRejection", handler);

            try {
                expect(onSpy).toHaveBeenCalledWith("unhandledRejection", handler);
            } finally {
                cleanup();
            }
        });
    });
});

describe("runtime-process (Bun simulation)", () => {
    beforeEach(() => {
        // Real Bun exposes a Node-compatible global `process` and only a `Bun`
        // marker carrying `Bun.version` (there is no `Bun.process`). Model that
        // shape so the tests exercise the real runtime contract.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (globalThis as any).Bun = {
            version: "1.0.0",
        };
    });

    afterEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        delete (globalThis as any).Bun;
        vi.restoreAllMocks();
    });

    it("getArgv falls through to the Node-compatible process.argv", () => {
        expect.assertions(1);

        expect(getArgv()).toStrictEqual(process.argv);
    });

    it("getCwd falls through to the Node-compatible process.cwd()", () => {
        expect.assertions(1);

        expect(getCwd()).toBe(process.cwd());
    });

    it("getEnv falls through to the Node-compatible process.env", () => {
        expect.assertions(1);

        expect(getEnv()).toBe(process.env);
    });

    it("getExecArgv falls through to the Node-compatible process.execArgv", () => {
        expect.assertions(1);

        expect(getExecArgv()).toStrictEqual(process.execArgv);
    });

    it("getExecPath falls through to the Node-compatible process.execPath", () => {
        expect.assertions(1);

        expect(getExecPath()).toBe(process.execPath);
    });

    it("getPlatform falls through to the Node-compatible process.platform", () => {
        expect.assertions(1);

        expect(getPlatform()).toBe(process.platform);
    });

    it("getArch falls through to the Node-compatible process.arch", () => {
        expect.assertions(1);

        expect(getArch()).toBe(process.arch);
    });

    it("getVersions augments process.versions with Bun.version", () => {
        expect.assertions(1);

        expect(getVersions()).toStrictEqual({ ...process.versions, bun: "1.0.0" });
    });

    it("getVersions returns process.versions unchanged when Bun.version is missing", () => {
        expect.assertions(1);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        delete (globalThis as any).Bun.version;

        expect(getVersions()).toStrictEqual({ ...process.versions });
    });

    it("exitProcess calls the Node-compatible process.exit", () => {
        expect.assertions(1);

        const spy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => code as unknown as never) as never);

        exitProcess(3);

        expect(spy).toHaveBeenCalledWith(3);
    });

    it("onProcessEvent registers via the Node-compatible process.on and returns cleanup", () => {
        expect.assertions(2);

        const onSpy = vi.spyOn(process, "on").mockImplementation((() => process) as never);
        const removeSpy = vi.spyOn(process, "removeListener").mockImplementation((() => process) as never);

        const handler = vi.fn();
        const cleanup = onProcessEvent("uncaughtException", handler);

        expect(onSpy).toHaveBeenCalledWith("uncaughtException", handler);

        cleanup();

        expect(removeSpy).toHaveBeenCalledWith("uncaughtException", handler);

        expectTypeOf(cleanup).toBeFunction();
    });
});
