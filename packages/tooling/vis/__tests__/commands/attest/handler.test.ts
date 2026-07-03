import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("../../../src/pm/pm-runner"), () => {
    return {
        detectPm: () => {
            return { name: "pnpm", version: "10" };
        },
        runAdd: vi.fn(),
    };
});

vi.mock(import("../../../src/security/dependency-scan"), () => {
    return {
        lockedPackages: () => [{ isDev: false, name: "left-pad", version: "1.0.0" }],
    };
});

const runProvenanceMarshall = vi.fn<(...arguments_: unknown[]) => Promise<unknown[]>>();
const runSignatureMarshall = vi.fn<(...arguments_: unknown[]) => Promise<unknown[]>>();

vi.mock(import("../../../src/security/marshalls/provenance"), () => {
    return {
        runProvenanceMarshall: (...arguments_: unknown[]) => runProvenanceMarshall(...arguments_),
    };
});

vi.mock(import("../../../src/security/marshalls/signatures"), () => {
    return {
        runSignatureMarshall: (...arguments_: unknown[]) => runSignatureMarshall(...arguments_),
    };
});

// eslint-disable-next-line import/first
import { attestVerifyExecute } from "../../../src/commands/attest/handler";

const makeToolbox = (options: Record<string, unknown>) =>
    ({
        argument: [],
        logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
        options,
        workspaceRoot: "/ws",
    }) as never;

describe(attestVerifyExecute, () => {
    let stdout: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        runProvenanceMarshall.mockReset();
        runSignatureMarshall.mockReset();
        process.exitCode = undefined;
        stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        stdout.mockRestore();
        process.exitCode = undefined;
    });

    it("emits ok:true and no failure when there are no findings", async () => {
        expect.assertions(2);

        runProvenanceMarshall.mockResolvedValue([]);
        runSignatureMarshall.mockResolvedValue([]);

        await attestVerifyExecute(makeToolbox({ format: "json" }));

        const payload = JSON.parse((stdout.mock.calls[0]?.[0] as string) ?? "{}");

        expect(payload.ok).toBe(true);
        expect(process.exitCode).toBeUndefined();
    });

    it("maps a provenance regression to a warning finding and exits 1 by default", async () => {
        expect.assertions(3);

        runProvenanceMarshall.mockResolvedValue([{ packageName: "left-pad", priorVersionWithProvenance: "0.9.0", version: "1.0.0" }]);
        runSignatureMarshall.mockResolvedValue([]);

        await attestVerifyExecute(makeToolbox({ format: "json" }));

        const payload = JSON.parse((stdout.mock.calls[0]?.[0] as string) ?? "{}");

        expect(payload.findings[0].code).toBe("provenance-regression");
        expect(payload.findings[0].severity).toBe("warning");
        expect(process.exitCode).toBe(1);
    });

    it("does not exit non-zero on warning findings when --fail-on=error", async () => {
        expect.assertions(1);

        runProvenanceMarshall.mockResolvedValue([{ packageName: "left-pad", priorVersionWithProvenance: "0.9.0", version: "1.0.0" }]);
        runSignatureMarshall.mockResolvedValue([]);

        await attestVerifyExecute(makeToolbox({ failOn: "error", format: "json" }));

        expect(process.exitCode).toBeUndefined();
    });

    it("exits 1 on an error-severity signature finding even with --fail-on=error", async () => {
        expect.assertions(1);

        runProvenanceMarshall.mockResolvedValue([]);
        runSignatureMarshall.mockResolvedValue([{ code: "invalid-signature", message: "bad", packageName: "left-pad", severity: "error", version: "1.0.0" }]);

        await attestVerifyExecute(makeToolbox({ failOn: "error", format: "json" }));

        expect(process.exitCode).toBe(1);
    });
});
