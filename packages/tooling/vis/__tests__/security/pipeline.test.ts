import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runArchivedRepoMarshall } from "../../src/security/marshalls/archived-repo";
import { runAuthorMarshall } from "../../src/security/marshalls/author";
import { presentMarshallFindings } from "../../src/security/marshalls/decision-prompt";
import { runDownloadsMarshall } from "../../src/security/marshalls/downloads";
import { runExpiredDomainsMarshall } from "../../src/security/marshalls/expired-domains";
import { MarshallFindings } from "../../src/security/marshalls/findings";
import { runMetadataMarshall } from "../../src/security/marshalls/metadata";
import { runNewBinMarshall } from "../../src/security/marshalls/new-bin";
import { runMarshallPipeline } from "../../src/security/marshalls/pipeline";
import { runProvenanceMarshall } from "../../src/security/marshalls/provenance";
import { runSignatureMarshall } from "../../src/security/marshalls/signatures";

vi.mock(import("../../src/security/marshalls/archived-repo"), () => {
    return { runArchivedRepoMarshall: vi.fn(async () => []) };
});
vi.mock(import("../../src/security/marshalls/author"), () => {
    return { runAuthorMarshall: vi.fn(async () => []) };
});
vi.mock(import("../../src/security/marshalls/downloads"), () => {
    return { runDownloadsMarshall: vi.fn(async () => []) };
});
vi.mock(import("../../src/security/marshalls/expired-domains"), () => {
    return { runExpiredDomainsMarshall: vi.fn(async () => []) };
});
vi.mock(import("../../src/security/marshalls/metadata"), () => {
    return { runMetadataMarshall: vi.fn(async () => []) };
});
vi.mock(import("../../src/security/marshalls/new-bin"), () => {
    return { runNewBinMarshall: vi.fn(async () => []) };
});
vi.mock(import("../../src/security/marshalls/provenance"), () => {
    return { runProvenanceMarshall: vi.fn(async () => []) };
});
vi.mock(import("../../src/security/marshalls/signatures"), () => {
    return { runSignatureMarshall: vi.fn(async () => []) };
});
vi.mock(import("../../src/security/marshalls/packument"), () => {
    return { clearPackumentCache: vi.fn(() => 0), getPackument: vi.fn(async () => undefined) };
});

describe(runMarshallPipeline, () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(runAuthorMarshall).mockResolvedValue([]);
        vi.mocked(runProvenanceMarshall).mockResolvedValue([]);
        vi.mocked(runNewBinMarshall).mockResolvedValue([]);
        vi.mocked(runMetadataMarshall).mockResolvedValue([]);
        vi.mocked(runDownloadsMarshall).mockResolvedValue([]);
        vi.mocked(runExpiredDomainsMarshall).mockResolvedValue([]);
        vi.mocked(runSignatureMarshall).mockResolvedValue([]);
        vi.mocked(runArchivedRepoMarshall).mockResolvedValue([]);
    });

    it("returns an empty accumulator and runs nothing for empty input", async () => {
        expect.assertions(2);

        const findings = await runMarshallPipeline([]);

        expect(findings.isEmpty()).toBe(true);
        expect(vi.mocked(runAuthorMarshall)).not.toHaveBeenCalled();
    });

    it("runs every marshall except signatures by default", async () => {
        expect.assertions(8);

        await runMarshallPipeline([{ name: "demo", version: "1.0.0" }]);

        expect(vi.mocked(runAuthorMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runProvenanceMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runNewBinMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runMetadataMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runDownloadsMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runExpiredDomainsMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runArchivedRepoMarshall)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runSignatureMarshall)).not.toHaveBeenCalled();
    });

    it("runs signatures only when explicitly enabled", async () => {
        expect.assertions(1);

        await runMarshallPipeline([{ name: "demo", version: "1.0.0" }], {
            config: { signatures: { enabled: true } },
        });

        expect(vi.mocked(runSignatureMarshall)).toHaveBeenCalledTimes(1);
    });

    it("skips a marshall when its config block sets enabled: false", async () => {
        expect.assertions(2);

        await runMarshallPipeline([{ name: "demo", version: "1.0.0" }], {
            config: { author: { enabled: false }, downloads: { enabled: false } },
        });

        expect(vi.mocked(runAuthorMarshall)).not.toHaveBeenCalled();
        expect(vi.mocked(runDownloadsMarshall)).not.toHaveBeenCalled();
    });

    it("forwards author thresholds nested under `thresholds`", async () => {
        expect.assertions(1);

        await runMarshallPipeline([{ name: "demo", version: "1.0.0" }], {
            config: { author: { dormantErrorDays: 999, recentVersionWarnDays: 30 } },
        });

        expect(vi.mocked(runAuthorMarshall).mock.calls[0]?.[1]?.thresholds).toStrictEqual({
            dormantErrorDays: 999,
            dormantWarnDays: undefined,
            newPublisherWindowDays: undefined,
            recentVersionErrorDays: undefined,
            recentVersionWarnDays: 30,
        });
    });

    it("aggregates findings from multiple marshalls into one accumulator", async () => {
        expect.assertions(3);

        vi.mocked(runAuthorMarshall).mockResolvedValue([
            {
                kind: "recent-version",
                message: "published 2 days ago",
                packageName: "demo",
                severity: "error",
                version: "1.0.0",
            },
        ]);
        vi.mocked(runDownloadsMarshall).mockResolvedValue([{ downloadsLastMonth: 50, kind: "below-warning", packageName: "demo", severity: "warning" }]);

        const findings = await runMarshallPipeline([{ name: "demo", version: "1.0.0" }]);

        expect(findings.all()).toHaveLength(2);
        expect(findings.errors()).toHaveLength(1);
        expect(findings.warnings()).toHaveLength(1);
    });
});

describe(presentMarshallFindings, () => {
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        stdoutSpy.mockRestore();
    });

    it("proceeds silently when there are no findings", async () => {
        expect.assertions(2);

        const findings = new MarshallFindings();
        const writes: string[] = [];
        const output = { isTTY: false, write: (chunk: string) => writes.push(chunk) };

        const proceed = await presentMarshallFindings(findings, { isCi: true, output });

        expect(proceed).toBe(true);
        expect(writes).toHaveLength(0);
    });

    it("aborts on errors in CI", async () => {
        expect.assertions(2);

        const findings = new MarshallFindings();

        findings.add({ marshall: "author", message: "published 2 days ago", packageName: "demo", severity: "error" });

        const writes: string[] = [];
        const output = { isTTY: false, write: (chunk: string) => writes.push(chunk) };

        const proceed = await presentMarshallFindings(findings, { isCi: true, output });

        expect(proceed).toBe(false);
        expect(writes.some((chunk) => chunk.includes("demo"))).toBe(true);
    });

    it("aborts on warnings when strict is set", async () => {
        expect.assertions(1);

        const findings = new MarshallFindings();

        findings.add({ marshall: "downloads", message: "Only 50 downloads in the past month.", packageName: "demo", severity: "warning" });

        const proceed = await presentMarshallFindings(findings, {
            isCi: true,
            isTty: false,
            output: { isTTY: false, write: () => {} },
            strict: true,
        });

        expect(proceed).toBe(false);
    });

    it("auto-proceeds on warnings in non-TTY mode without strict", async () => {
        expect.assertions(1);

        const findings = new MarshallFindings();

        findings.add({ marshall: "downloads", message: "Only 50 downloads in the past month.", packageName: "demo", severity: "warning" });

        const proceed = await presentMarshallFindings(findings, {
            isCi: false,
            isTty: false,
            output: { isTTY: false, write: () => {} },
            strict: false,
        });

        expect(proceed).toBe(true);
    });
});
