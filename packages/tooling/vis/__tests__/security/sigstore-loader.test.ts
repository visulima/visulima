import { describe, expect, it, vi } from "vitest";

import { loadOptionalSigstore } from "../../src/security/sigstore/loader";

const moduleNotFound = (): NodeJS.ErrnoException => {
    const error: NodeJS.ErrnoException = new Error("Cannot find package 'sigstore'");

    error.code = "ERR_MODULE_NOT_FOUND";

    return error;
};

describe(loadOptionalSigstore, () => {
    it("should return the module when the import resolves on first try", async () => {
        expect.assertions(2);

        const stub = { attest: vi.fn(), sign: vi.fn(), verify: vi.fn() };
        const importImpl = vi.fn(async () => stub);

        const loaded = await loadOptionalSigstore({ importImpl });

        expect(loaded).toBe(stub);
        expect(importImpl).toHaveBeenCalledTimes(1);
    });

    it("should throw with the install command when missing in non-interactive mode", async () => {
        expect.assertions(2);

        const importImpl = vi.fn(async () => {
            throw moduleNotFound();
        });

        await expect(loadOptionalSigstore({ importImpl, interactive: false })).rejects.toThrow(/pnpm add -D sigstore/);

        expect(importImpl).toHaveBeenCalledTimes(1);
    });

    it("should prompt and install in interactive mode, then re-import", async () => {
        expect.assertions(4);

        const stub = { attest: vi.fn(), sign: vi.fn(), verify: vi.fn() };
        let attempts = 0;
        const importImpl = vi.fn(async () => {
            attempts += 1;

            if (attempts === 1) {
                throw moduleNotFound();
            }

            return stub;
        });
        const prompt = vi.fn(async () => true);
        const runInstall = vi.fn(async () => {
            return { exitCode: 0 };
        });

        const loaded = await loadOptionalSigstore({
            importImpl,
            interactive: true,
            prompt,
            runInstall,
            workspaceRoot: "/ws",
        });

        expect(loaded).toBe(stub);
        expect(prompt).toHaveBeenCalledTimes(1);
        expect(runInstall).toHaveBeenCalledWith("/ws");
        expect(importImpl).toHaveBeenCalledTimes(2);
    });

    it("should throw when the user declines the install prompt", async () => {
        expect.assertions(2);

        const importImpl = vi.fn(async () => {
            throw moduleNotFound();
        });
        const runInstall = vi.fn(async () => {
            return { exitCode: 0 };
        });

        await expect(
            loadOptionalSigstore({
                importImpl,
                interactive: true,
                prompt: async () => false,
                runInstall,
            }),
        ).rejects.toThrow(/install declined/);

        expect(runInstall).not.toHaveBeenCalled();
    });

    it("should throw when the install spawn exits non-zero", async () => {
        expect.assertions(1);

        const importImpl = vi.fn(async () => {
            throw moduleNotFound();
        });

        await expect(
            loadOptionalSigstore({
                importImpl,
                interactive: true,
                prompt: async () => true,
                runInstall: async () => {
                    return { exitCode: 1 };
                },
            }),
        ).rejects.toThrow(/Install of sigstore failed/);
    });

    it("should bubble unexpected errors verbatim", async () => {
        expect.assertions(2);

        const boom = new SyntaxError("Unexpected token in sigstore's index.js");
        const importImpl = vi.fn(async () => {
            throw boom;
        });

        await expect(loadOptionalSigstore({ importImpl, interactive: false })).rejects.toBe(boom);
        expect(importImpl).toHaveBeenCalledTimes(1);
    });
});
