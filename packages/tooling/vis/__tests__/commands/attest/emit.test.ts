import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sigstoreMock = { attest: vi.fn(), sign: vi.fn(), verify: vi.fn() };

vi.mock(import("../../../src/security/sigstore/loader"), () => {
    return {
        loadOptionalSigstore: vi.fn(async () => sigstoreMock),
    };
});

// eslint-disable-next-line import/first
import { attestEmitExecute } from "../../../src/commands/attest/handler";

const makeSubject = (): string => {
    const dir = mkdtempSync(join(tmpdir(), "vis-emit-"));
    const path = join(dir, "app.tgz");

    writeFileSync(path, "artifact-bytes");

    return path;
};

const makeToolbox = (argument: string[], options: Record<string, unknown>) =>
    ({
        argument,
        logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
        options,
        workspaceRoot: "/ws",
    }) as never;

describe(attestEmitExecute, () => {
    let stdout: ReturnType<typeof vi.spyOn>;
    const originalCi = process.env.CI;

    beforeEach(() => {
        sigstoreMock.attest.mockReset();
        delete process.env.CI;
        delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
        delete process.env.SIGSTORE_ID_TOKEN;
        stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        stdout.mockRestore();

        if (originalCi === undefined) {
            delete process.env.CI;
        } else {
            process.env.CI = originalCi;
        }
    });

    it("throws when the subject argument is missing", async () => {
        expect.assertions(1);

        await expect(attestEmitExecute(makeToolbox([], {}))).rejects.toThrow(/Missing subject/);
    });

    it("throws on an unsupported predicate", async () => {
        expect.assertions(1);

        await expect(attestEmitExecute(makeToolbox([makeSubject()], { predicate: "spdx" }))).rejects.toThrow(/Unsupported predicate/);
    });

    it("skips with a warning (no throw) when no ambient OIDC and signing not required", async () => {
        expect.assertions(2);

        const toolbox = makeToolbox([makeSubject()], {});

        await expect(attestEmitExecute(toolbox)).resolves.toBeUndefined();
        expect(sigstoreMock.attest).not.toHaveBeenCalled();
    });

    it("emits a JSON skip document on stdout when --format=json and no OIDC", async () => {
        expect.assertions(2);

        await attestEmitExecute(makeToolbox([makeSubject()], { format: "json" }));

        const payload = JSON.parse((stdout.mock.calls[0]?.[0] as string) ?? "{}");

        expect(payload).toMatchObject({ ok: false, reason: "no-ambient-oidc", skipped: true });
        expect(sigstoreMock.attest).not.toHaveBeenCalled();
    });

    it("throws instead of skipping when --require-signing and no OIDC", async () => {
        expect.assertions(1);

        await expect(attestEmitExecute(makeToolbox([makeSubject()], { requireSigning: true }))).rejects.toThrow(/Re-run in CI or drop --require-signing/);
    });

    it("signs and writes a bundle when ambient OIDC is present (--format=json)", async () => {
        expect.assertions(3);

        process.env.CI = "true";
        sigstoreMock.attest.mockResolvedValue({ bundle: "signed" });

        const subject = makeSubject();
        const output = `${subject}.sigstore`;

        await attestEmitExecute(makeToolbox([subject], { format: "json", output }));

        const payload = JSON.parse((stdout.mock.calls[0]?.[0] as string) ?? "{}");

        expect(payload.ok).toBe(true);
        expect(sigstoreMock.attest).toHaveBeenCalledTimes(1);
        expect(JSON.parse(readFileSync(output, "utf8"))).toStrictEqual({ bundle: "signed" });
    });
});
