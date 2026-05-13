import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parsePackageArg } from "../../../src/commands/inspect/handler";
import { runArchivedRepoMarshall } from "../../../src/security/marshalls/archived-repo";
import { runAuthorMarshall } from "../../../src/security/marshalls/author";
import { runDownloadsMarshall } from "../../../src/security/marshalls/downloads";
import { runExpiredDomainsMarshall } from "../../../src/security/marshalls/expired-domains";
import { runMetadataMarshall } from "../../../src/security/marshalls/metadata";
import { runNewBinMarshall } from "../../../src/security/marshalls/new-bin";
import { getPackument, resolveVersionRange } from "../../../src/security/marshalls/packument";
import { runProvenanceMarshall } from "../../../src/security/marshalls/provenance";
import { runSignatureMarshall } from "../../../src/security/marshalls/signatures";

vi.mock(import("../../../src/security/marshalls/packument"), () => {
    return {
        getPackument: vi.fn(),
        resolveVersionRange: vi.fn(),
    };
});

vi.mock(import("../../../src/security/marshalls/author"), () => {
    return { runAuthorMarshall: vi.fn(async () => []) };
});
vi.mock(import("../../../src/security/marshalls/provenance"), () => {
    return { runProvenanceMarshall: vi.fn(async () => []) };
});
vi.mock(import("../../../src/security/marshalls/new-bin"), () => {
    return { runNewBinMarshall: vi.fn(async () => []) };
});
vi.mock(import("../../../src/security/marshalls/metadata"), () => {
    return { runMetadataMarshall: vi.fn(async () => []) };
});
vi.mock(import("../../../src/security/marshalls/downloads"), () => {
    return { runDownloadsMarshall: vi.fn(async () => []) };
});
vi.mock(import("../../../src/security/marshalls/expired-domains"), () => {
    return { runExpiredDomainsMarshall: vi.fn(async () => []) };
});
vi.mock(import("../../../src/security/marshalls/signatures"), () => {
    return { runSignatureMarshall: vi.fn(async () => []) };
});
vi.mock(import("../../../src/security/marshalls/archived-repo"), () => {
    return { runArchivedRepoMarshall: vi.fn(async () => []) };
});

vi.mock(import("../../../src/io/logger"), () => {
    return { pail: { error: vi.fn(), info: vi.fn(), notice: vi.fn(), success: vi.fn(), warn: vi.fn() } };
});

const inspectModulePromise = import("../../../src/commands/inspect/handler");

interface ToolboxShape {
    argument: string[];
    logger: { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
    options: Record<string, unknown>;
    visConfig: undefined;
    workspaceRoot: string | undefined;
}

const buildToolbox = (overrides: Partial<ToolboxShape> = {}): ToolboxShape => {
    return {
        argument: ["demo"],
        logger: { error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() },
        options: {},
        visConfig: undefined,
        workspaceRoot: undefined,
        ...overrides,
    };
};

describe(parsePackageArg, () => {
    it("returns name when no version is supplied", () => {
        expect.assertions(1);
        expect(parsePackageArg("react")).toStrictEqual({ name: "react", spec: undefined });
    });

    it("splits name@version", () => {
        expect.assertions(1);
        expect(parsePackageArg("lodash@4.17.21")).toStrictEqual({ name: "lodash", spec: "4.17.21" });
    });

    it("preserves scope for scoped names without a spec", () => {
        expect.assertions(1);
        expect(parsePackageArg("@scope/pkg")).toStrictEqual({ name: "@scope/pkg", spec: undefined });
    });

    it("splits scoped name@spec on the second @", () => {
        expect.assertions(1);
        expect(parsePackageArg("@scope/pkg@^1.2")).toStrictEqual({ name: "@scope/pkg", spec: "^1.2" });
    });

    it("returns undefined for empty input", () => {
        expect.assertions(1);
        expect(parsePackageArg("  ")).toBeUndefined();
    });
});

describe("inspect handler", () => {
    let stdoutSpy: ReturnType<typeof vi.spyOn>;
    let originalExitCode: number | string | undefined;

    beforeEach(() => {
        vi.clearAllMocks();
        stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        originalExitCode = process.exitCode;
        process.exitCode = 0;

        vi.mocked(getPackument).mockResolvedValue({
            "dist-tags": { latest: "1.0.0" },
            name: "demo",
            versions: { "1.0.0": { version: "1.0.0" } },
        });
        vi.mocked(resolveVersionRange).mockReturnValue("1.0.0");

        // Each marshall defaults to "no findings" — individual tests override.
        vi.mocked(runAuthorMarshall).mockResolvedValue([]);
        vi.mocked(runProvenanceMarshall).mockResolvedValue([]);
        vi.mocked(runNewBinMarshall).mockResolvedValue([]);
        vi.mocked(runMetadataMarshall).mockResolvedValue([]);
        vi.mocked(runDownloadsMarshall).mockResolvedValue([]);
        vi.mocked(runExpiredDomainsMarshall).mockResolvedValue([]);
        vi.mocked(runSignatureMarshall).mockResolvedValue([]);
        vi.mocked(runArchivedRepoMarshall).mockResolvedValue([]);
    });

    afterEach(() => {
        stdoutSpy.mockRestore();
        process.exitCode = originalExitCode;
    });

    it("emits no findings + exit 0 on a clean package", async () => {
        expect.assertions(2);

        const { default: execute } = await inspectModulePromise;

        await execute(buildToolbox() as never);

        expect(process.exitCode).toBe(0);
        expect(vi.mocked(runAuthorMarshall)).toHaveBeenCalledTimes(1);
    });

    it("sets exit code 1 on an error finding", async () => {
        expect.assertions(1);

        const { default: execute } = await inspectModulePromise;

        vi.mocked(runAuthorMarshall).mockResolvedValue([
            {
                kind: "recent-version",
                message: "published 2 days ago",
                packageName: "demo",
                severity: "error",
                version: "1.0.0",
            },
        ]);

        await execute(buildToolbox() as never);

        expect(process.exitCode).toBe(1);
    });

    it("exits 0 on warnings by default", async () => {
        expect.assertions(1);

        const { default: execute } = await inspectModulePromise;

        vi.mocked(runDownloadsMarshall).mockResolvedValue([
            { downloadsLastMonth: 5000, kind: "below-warning", packageName: "demo", severity: "warning" },
        ]);

        await execute(buildToolbox() as never);

        expect(process.exitCode).toBe(0);
    });

    it("exits 1 on warnings when --strict is set", async () => {
        expect.assertions(1);

        const { default: execute } = await inspectModulePromise;

        vi.mocked(runDownloadsMarshall).mockResolvedValue([
            { downloadsLastMonth: 5000, kind: "below-warning", packageName: "demo", severity: "warning" },
        ]);

        await execute(buildToolbox({ options: { strict: true } }) as never);

        expect(process.exitCode).toBe(1);
    });

    it("emits parseable JSON with --json", async () => {
        expect.assertions(3);

        const { default: execute } = await inspectModulePromise;

        vi.mocked(runDownloadsMarshall).mockResolvedValue([
            { downloadsLastMonth: 5000, kind: "below-warning", packageName: "demo", severity: "warning" },
        ]);

        await execute(buildToolbox({ options: { json: true } }) as never);

        const jsonOutput: string = stdoutSpy.mock.calls.map((call) => String(call[0])).join("");
        const parsed = JSON.parse(jsonOutput.trim()) as { findings: unknown[]; summary: { errorCount: number; warningCount: number } };

        expect(parsed.findings).toHaveLength(1);
        expect(parsed.summary.warningCount).toBe(1);
        expect(parsed.summary.errorCount).toBe(0);
    });

    it("respects --only and skips unlisted marshalls", async () => {
        expect.assertions(2);

        const { default: execute } = await inspectModulePromise;

        await execute(buildToolbox({ options: { only: "author,downloads" } }) as never);

        expect(vi.mocked(runAuthorMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runMetadataMarshall)).not.toHaveBeenCalled();
    });

    it("throws when --only references an unknown marshall", async () => {
        expect.assertions(1);

        const { default: execute } = await inspectModulePromise;

        await expect(execute(buildToolbox({ options: { only: "bogus" } }) as never)).rejects.toThrow(/Unknown marshall in --only: bogus/);
    });

    it("exits with code 2 when the package is not found", async () => {
        expect.assertions(1);

        const { default: execute } = await inspectModulePromise;

        vi.mocked(getPackument).mockResolvedValue(undefined);

        await execute(buildToolbox() as never);

        expect(process.exitCode).toBe(2);
    });

    it("exits with code 2 when the spec cannot be resolved", async () => {
        expect.assertions(1);

        const { default: execute } = await inspectModulePromise;

        vi.mocked(resolveVersionRange).mockReturnValue(undefined);

        await execute(buildToolbox({ argument: ["demo@^99"], options: {} }) as never);

        expect(process.exitCode).toBe(2);
    });

    it("throws when no argument is supplied", async () => {
        expect.assertions(1);

        const { default: execute } = await inspectModulePromise;

        await expect(execute(buildToolbox({ argument: [] }) as never)).rejects.toThrow(/No package specified/);
    });

    it("runs every marshall except signatures when --only is omitted", async () => {
        expect.assertions(8);

        const { default: execute } = await inspectModulePromise;

        await execute(buildToolbox() as never);

        expect(vi.mocked(runAuthorMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runProvenanceMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runNewBinMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runMetadataMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runDownloadsMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runExpiredDomainsMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runArchivedRepoMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runSignatureMarshall)).not.toHaveBeenCalled();
    });

    it("runs signatures only when --only explicitly lists it", async () => {
        expect.assertions(2);

        const { default: execute } = await inspectModulePromise;

        await execute(buildToolbox({ options: { only: "signatures" } }) as never);

        expect(vi.mocked(runSignatureMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runAuthorMarshall)).not.toHaveBeenCalled();
    });
});
