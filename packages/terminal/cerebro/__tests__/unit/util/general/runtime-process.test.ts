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
        // Clean up any globals our Deno/Bun simulation may have added.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        delete (globalThis as any).Deno;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        delete (globalThis as any).Bun;
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

describe("runtime-process (Deno simulation)", () => {
    let denoEnvStore: Record<string, string>;

    beforeEach(() => {
        denoEnvStore = { FOO: "bar" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (globalThis as any).Deno = {
            args: ["script-arg", "--flag"],

            build: { arch: "x86_64", os: "linux" },
            cwd: () => "/deno/cwd",
            env: {
                get: (key: string) => denoEnvStore[key],
                has: (key: string) => key in denoEnvStore,
                set: (key: string, value: string) => {
                    denoEnvStore[key] = value;
                },
                toObject: () => {
                    return { ...denoEnvStore };
                },
            },
            execPath: () => "/usr/bin/deno",
            exit: vi.fn(),
            version: { deno: "1.30.0", typescript: "5.0.0", v8: "11.0.0" },
        };
    });

    afterEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        delete (globalThis as any).Deno;
    });

    it("getArgv constructs argv [execPath, scriptPath, ...args]", () => {
        expect.assertions(3);

        const argv = getArgv();

        expect(argv[0]).toBe("/usr/bin/deno");
        expect(argv[1]).toBe("/usr/bin/deno");
        expect(argv.slice(2)).toStrictEqual(["script-arg", "--flag"]);
    });

    it("getCwd returns Deno.cwd()", () => {
        expect.assertions(1);

        expect(getCwd()).toBe("/deno/cwd");
    });

    it("getEnv returns a proxy that reads from Deno.env.get", () => {
        expect.assertions(2);

        const env = getEnv();

        expect(env.FOO).toBe("bar");

        env.NEW_VAR = "new";

        expect(denoEnvStore.NEW_VAR).toBe("new");
    });

    it("getEnv proxy 'has' delegates to Deno.env.has", () => {
        expect.assertions(2);

        const env = getEnv();

        expect("FOO" in env).toBe(true);
        expect("MISSING" in env).toBe(false);
    });

    it("getEnv proxy returns true when setting undefined (no-op in Deno)", () => {
        expect.assertions(1);

        const env = getEnv();

        env.FOO = undefined;

        // The original value remains because Deno can't delete
        expect(denoEnvStore.FOO).toBe("bar");
    });

    it("getExecArgv returns empty array in Deno", () => {
        expect.assertions(1);

        expect(getExecArgv()).toStrictEqual([]);
    });

    it("getExecPath returns Deno.execPath()", () => {
        expect.assertions(1);

        expect(getExecPath()).toBe("/usr/bin/deno");
    });

    it("getPlatform maps Deno os to Node-compatible values", () => {
        expect.assertions(2);

        expect(getPlatform()).toBe("linux");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (globalThis as any).Deno.build.os = "windows";

        expect(getPlatform()).toBe("win32");
    });

    it("getPlatform returns 'unknown' if Deno.build.os is undefined", () => {
        expect.assertions(1);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (globalThis as any).Deno.build = {};

        expect(getPlatform()).toBe("unknown");
    });

    it("getArch maps x86_64 → x64 and aarch64 → arm64", () => {
        expect.assertions(3);

        expect(getArch()).toBe("x64");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (globalThis as any).Deno.build.arch = "aarch64";

        expect(getArch()).toBe("arm64");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (globalThis as any).Deno.build.arch = "riscv64";

        expect(getArch()).toBe("riscv64");
    });

    it("getArch returns 'unknown' if Deno.build.arch is undefined", () => {
        expect.assertions(1);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (globalThis as any).Deno.build = {};

        expect(getArch()).toBe("unknown");
    });

    it("getVersions returns deno/v8/typescript versions when available", () => {
        expect.assertions(1);

        expect(getVersions()).toStrictEqual({
            deno: "1.30.0",
            typescript: "5.0.0",
            v8: "11.0.0",
        });
    });

    it("getVersions returns empty object when Deno.version is missing", () => {
        expect.assertions(1);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (globalThis as any).Deno.version = undefined;

        expect(getVersions()).toStrictEqual({});
    });

    it("exitProcess calls Deno.exit", () => {
        expect.assertions(2);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const exitMock = (globalThis as any).Deno.exit;

        // The wrapper throws after calling exit (since the mock returns instead of terminating).
        expect(() => exitProcess(7)).toThrow("Deno exit failed");
        expect(exitMock).toHaveBeenCalledWith(7);
    });

    it("onProcessEvent returns a no-op cleanup function on Deno", () => {
        expect.assertions(1);

        const cleanup = onProcessEvent("uncaughtException", () => {});

        expectTypeOf(cleanup).toBeFunction();

        const run = (): void => {
            cleanup();
        };

        expect(run).not.toThrow();
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
