import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LockfileVerificationResult } from "../../../src/security/lockfile-verification";

const pailMock = { error: vi.fn(), info: vi.fn(), success: vi.fn(), warn: vi.fn() };

vi.mock(import("../../../src/io/logger"), () => {
    return { pail: pailMock };
});

const detectPmMock = vi.fn(() => {
    return { name: "npm", version: "10.0.0" };
});

vi.mock(import("../../../src/pm/pm-runner"), () => {
    return { detectPm: detectPmMock };
});

const verifyLockfileMock = vi.fn();

vi.mock(import("../../../src/security/lockfile-verification"), async (importOriginal) => {
    const actual = await importOriginal();

    return { ...actual, verifyLockfile: verifyLockfileMock };
});

const handlerPromise = import("../../../src/commands/security/verify-lockfile");

const buildToolbox = (options: { json?: boolean; offline?: boolean } = {}): unknown => {
    return {
        options,
        visConfig: {},
        workspaceRoot: "/tmp/ws",
    };
};

const result = (over: Partial<LockfileVerificationResult>): LockfileVerificationResult => {
    return {
        decisions: [],
        durationMs: 5,
        entryCount: 3,
        exoticViolations: [],
        lockfileMissing: false,
        status: "pass",
        ...over,
    };
};

describe("security verify-lockfile handler", () => {
    let writeSpy: ReturnType<typeof vi.spyOn>;
    let written: string[];

    beforeEach(() => {
        pailMock.error.mockClear();
        pailMock.info.mockClear();
        pailMock.success.mockClear();
        pailMock.warn.mockClear();
        verifyLockfileMock.mockReset();
        detectPmMock.mockReturnValue({ name: "npm", version: "10.0.0" });

        written = [];
        writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
            written.push(String(chunk));

            return true;
        });
    });

    afterEach(() => {
        writeSpy.mockRestore();
        process.exitCode = undefined;
    });

    it("warns and does not verify when the package manager has no lockfile vis understands", async () => {
        expect.assertions(2);

        detectPmMock.mockReturnValue({ name: "cargo", version: "1.0.0" });

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox() as never);

        expect(pailMock.warn).toHaveBeenCalledWith(expect.stringContaining("cargo"));
        expect(verifyLockfileMock).not.toHaveBeenCalled();
    });

    it("reports a skipped run via pail.info without setting a failing exit code", async () => {
        expect.assertions(2);

        verifyLockfileMock.mockResolvedValue(result({ entryCount: 0, status: "skipped" }));

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox() as never);

        expect(pailMock.info).toHaveBeenCalledWith(expect.stringContaining("skipped"));
        expect(process.exitCode).toBeUndefined();
    });

    it("reports a pass via pail.success without setting a failing exit code", async () => {
        expect.assertions(2);

        verifyLockfileMock.mockResolvedValue(result({ status: "pass" }));

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox() as never);

        expect(pailMock.success).toHaveBeenCalledWith(expect.stringContaining("✓ Lockfile passes supply-chain policies"));
        expect(process.exitCode).toBeUndefined();
    });

    it("prints the headline plus every detail line and exits 1 on failure", async () => {
        expect.assertions(4);

        verifyLockfileMock.mockResolvedValue(
            result({
                exoticViolations: [{ declaredBy: "prod-pkg@1.0.0", packageName: "git-dep", source: "github:attacker/evil#deadbeef" }],
                status: "fail",
            }),
        );

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox() as never);

        expect(pailMock.error).toHaveBeenCalledWith(expect.stringContaining("✗ Lockfile failed supply-chain policy check"));
        expect(pailMock.error).toHaveBeenCalledWith(
            "  [blockExoticSubdeps] git-dep pulled from exotic source by prod-pkg@1.0.0: github:attacker/evil#deadbeef",
        );
        expect(pailMock.success).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(1);
    });

    it("surfaces the missing-lockfile failure and exits 1", async () => {
        expect.assertions(2);

        verifyLockfileMock.mockResolvedValue(result({ entryCount: 0, lockfileMissing: true, status: "fail" }));

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox() as never);

        expect(pailMock.error).toHaveBeenCalledWith(expect.stringContaining("no lockfile found"));
        expect(process.exitCode).toBe(1);
    });

    it("--json emits the raw result and sets exit 1 on failure without using pail", async () => {
        expect.assertions(3);

        const payload = result({ entryCount: 0, lockfileMissing: true, status: "fail" });

        verifyLockfileMock.mockResolvedValue(payload);

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox({ json: true }) as never);

        expect(JSON.parse(written.join(""))).toStrictEqual(payload);
        expect(pailMock.error).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(1);
    });

    it("--json on a pass leaves the exit code untouched", async () => {
        expect.assertions(2);

        verifyLockfileMock.mockResolvedValue(result({ status: "pass" }));

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox({ json: true }) as never);

        expect(JSON.parse(written.join("")).status).toBe("pass");
        expect(process.exitCode).toBeUndefined();
    });

    it("forwards the --offline flag into verifyLockfile", async () => {
        expect.assertions(1);

        verifyLockfileMock.mockResolvedValue(result({ status: "pass" }));

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox({ offline: true }) as never);

        expect(verifyLockfileMock).toHaveBeenCalledWith(expect.objectContaining({ offline: true, packageManager: "npm" }));
    });
});
