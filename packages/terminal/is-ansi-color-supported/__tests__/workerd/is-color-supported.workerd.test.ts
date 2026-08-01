import { afterEach, describe, expect, it, vi } from "vitest";

import {
    createIsColorSupported as browserCreateIsColorSupported,
    isStdoutColorSupported as browserIsStdoutColorSupported,
} from "../../src/is-color-supported.browser";
import {
    createIsColorSupported as edgeCreateIsColorSupported,
    isStderrColorSupported as edgeIsStderrColorSupported,
    isStdoutColorSupported as edgeIsStdoutColorSupported,
} from "../../src/is-color-supported.edge-light";
import {
    createIsColorSupported as serverCreateIsColorSupported,
    isStderrColorSupported as serverIsStderrColorSupported,
    isStdoutColorSupported as serverIsStdoutColorSupported,
} from "../../src/is-color-supported.server";

/**
 * Every entry point must load and answer inside `workerd`. The package advertises
 * an `edge-light` export condition, so a runtime that has `process.env` but no
 * `process.stdout.isTTY`, no `node:tty` and only a stubbed `node:os` must still get
 * a level in `0..3` instead of a `ReferenceError` / `TypeError` at import time.
 */
const LEVELS = new Set([0, 1, 2, 3]);

/** Live view of the workerd globals under test; `vi.stubGlobal` swaps them in place. */
const globalScope = globalThis as unknown as {
    navigator: { userAgent: string };
    process: { env?: unknown; getBuiltinModule: (id: string) => unknown; stdout?: { isTTY?: unknown } };
};

describe("workerd runtime baseline", () => {
    it("should expose the workerd globals the detectors branch on", () => {
        expect.assertions(4);

        // `nodejs_compat` gives a `process` with `env`/`argv`/`platform`, but no TTY streams.
        expect(globalScope.process).toBeTypeOf("object");
        expect(globalScope.process.env).toBeTypeOf("object");
        expect(globalScope.process.stdout?.isTTY).toBeUndefined();
        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- workerd always defines `navigator`; the browser detector branches on it
        expect(globalScope.navigator.userAgent).toBe("Cloudflare-Workers");
    });
});

describe("is-color-supported.server (workerd)", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it("should resolve and return a valid level without throwing", () => {
        expect.assertions(2);

        expect(LEVELS.has(serverIsStdoutColorSupported())).toBe(true);
        expect(LEVELS.has(serverIsStderrColorSupported())).toBe(true);
    });

    it("should report no color for the bare workerd process (no TTY, no TERM)", () => {
        expect.assertions(2);

        vi.stubGlobal("process", {
            argv: ["workerd"],
            env: {},
            platform: "linux",
            stdout: {},
        });

        expect(serverIsStdoutColorSupported()).toBe(0);
        expect(serverIsStderrColorSupported()).toBe(0);
    });

    it("should honour FORCE_COLOR from the workerd process.env", () => {
        expect.assertions(1);

        vi.stubEnv("FORCE_COLOR", "3");

        expect(serverIsStdoutColorSupported()).toBe(3);
    });

    it("should honour NO_COLOR from the workerd process.env", () => {
        expect.assertions(1);

        vi.stubEnv("NO_COLOR", "1");

        expect(serverIsStdoutColorSupported()).toBe(0);
    });

    it("should sniff CLI flags from the workerd process.argv", () => {
        expect.assertions(1);

        vi.stubGlobal("process", {
            argv: ["workerd", "--color=256"],
            env: {},
            platform: "linux",
        });

        expect(serverCreateIsColorSupported("stdout")).toBe(2);
    });

    it("should ignore CLI flags when sniffFlags is disabled", () => {
        expect.assertions(1);

        vi.stubGlobal("process", {
            argv: ["workerd", "--color=256"],
            env: {},
            platform: "linux",
        });

        expect(serverCreateIsColorSupported("stdout", { sniffFlags: false })).toBe(0);
    });

    it("should treat the missing process.stdout.isTTY as not-a-TTY", () => {
        expect.assertions(2);

        vi.stubGlobal("process", {
            argv: ["workerd"],
            env: { TERM: "xterm" },
            platform: "linux",
            stdout: {},
        });

        // `xterm` matches the color-capable TERM pattern but is gated behind isTTY,
        // which workerd never sets.
        expect(serverIsStdoutColorSupported()).toBe(0);
        expect(serverCreateIsColorSupported("stdout", { isTTY: true })).toBe(1);
    });

    it("should not throw when process.argv is absent", () => {
        expect.assertions(1);

        vi.stubGlobal("process", { env: {}, platform: "linux" });

        expect(serverIsStdoutColorSupported()).toBe(0);
    });

    it("should not throw for a bare process shim with no env, argv or platform", () => {
        expect.assertions(2);

        vi.stubGlobal("process", {});

        expect(serverIsStdoutColorSupported()).toBe(0);
        expect(serverCreateIsColorSupported("stderr")).toBe(0);
    });

    it("should not throw on the Windows branch when node:os is a workerd stub", () => {
        expect.assertions(1);

        const getBuiltinModule = globalScope.process.getBuiltinModule.bind(globalScope.process);

        // workerd's `process.getBuiltinModule("node:os").release()` returns "", so the
        // build-number heuristic must degrade to the 16-color floor rather than NaN-crash.
        vi.stubGlobal("process", {
            argv: [],
            env: {},
            getBuiltinModule,
            platform: "win32",
        });

        expect(serverIsStdoutColorSupported()).toBe(1);
    });

    it("should not throw when process.getBuiltinModule is unavailable on the Windows branch", () => {
        expect.assertions(1);

        vi.stubGlobal("process", { argv: [], env: {}, platform: "win32" });

        expect(serverIsStdoutColorSupported()).toBe(1);
    });

    it("should not throw when there is no process global at all", () => {
        expect.assertions(1);

        vi.stubGlobal("process", undefined);

        expect(serverIsStdoutColorSupported()).toBe(0);
    });
});

describe("is-color-supported.browser (workerd)", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should report no color for the workerd navigator", () => {
        expect.assertions(2);

        // workerd defines `navigator.userAgent === "Cloudflare-Workers"` and no
        // `userAgentData`, so neither Chromium branch matches.
        expect(browserIsStdoutColorSupported()).toBe(0);
        expect(browserCreateIsColorSupported()).toBe(0);
    });

    it("should not read process at all", () => {
        expect.assertions(1);

        vi.stubGlobal("process", undefined);

        expect(browserIsStdoutColorSupported()).toBe(0);
    });
});

describe("is-color-supported.edge-light (workerd)", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it("should report no color on bare workerd", () => {
        expect.assertions(3);

        // Documented behaviour: workerd is not a terminal, so the edge-light build
        // falls through to the browser detector and reports mono.
        expect(edgeIsStdoutColorSupported()).toBe(0);
        expect(edgeIsStderrColorSupported()).toBe(0);
        expect(edgeCreateIsColorSupported("stderr")).toBe(0);
    });

    it("should report 16 colors when NEXT_RUNTIME marks an edge runtime", () => {
        expect.assertions(1);

        vi.stubEnv("NEXT_RUNTIME", "edge");

        expect(edgeIsStdoutColorSupported()).toBe(1);
    });

    it("should not throw when process is removed", () => {
        expect.assertions(1);

        vi.stubGlobal("process", undefined);

        expect(edgeIsStdoutColorSupported()).toBe(0);
    });

    it("should expose stdout and stderr detectors as the same implementation", () => {
        expect.assertions(1);

        expect(edgeIsStdoutColorSupported).toBe(edgeIsStderrColorSupported);
    });
});
