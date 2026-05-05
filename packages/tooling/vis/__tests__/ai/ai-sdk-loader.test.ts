import { describe, expect, it, vi } from "vitest";

import type { OptionalSdk } from "../../src/ai/sdk-loader";
import { loadOptionalSdk } from "../../src/ai/sdk-loader";

const moduleNotFound = (specifier: string): NodeJS.ErrnoException => {
    const error: NodeJS.ErrnoException = new Error(`Cannot find package '${specifier}'`);

    error.code = "ERR_MODULE_NOT_FOUND";

    return error;
};

describe(loadOptionalSdk, () => {
    it("should return the module when the import resolves on first try", async () => {
        expect.assertions(2);

        const stub = { Octokit: vi.fn() };
        const importImpl = vi.fn(async () => stub);

        const loaded = await loadOptionalSdk("@octokit/rest", { importImpl });

        expect(loaded).toBe(stub);
        expect(importImpl).toHaveBeenCalledTimes(1);
    });

    it("should throw with the install command when the SDK is missing in non-interactive mode", async () => {
        expect.assertions(2);

        const importImpl = vi.fn(async (specifier: OptionalSdk) => {
            throw moduleNotFound(specifier);
        });

        await expect(
            loadOptionalSdk("@octokit/rest", {
                importImpl,
                interactive: false,
            }),
        ).rejects.toThrow(/pnpm add @octokit\/rest/);

        // Non-interactive should NOT retry — we never get past the first import.
        expect(importImpl).toHaveBeenCalledTimes(1);
    });

    it("should prompt and install in interactive mode, then re-import", async () => {
        expect.assertions(4);

        const stub = { Gitlab: vi.fn() };
        let importsAttempted = 0;
        const importImpl = vi.fn(async (specifier: OptionalSdk) => {
            importsAttempted += 1;

            if (importsAttempted === 1) {
                throw moduleNotFound(specifier);
            }

            return stub;
        });
        const prompt = vi.fn(async () => true);
        const runInstall = vi.fn(async () => {
            return { exitCode: 0 };
        });

        const loaded = await loadOptionalSdk("@gitbeaker/rest", {
            importImpl,
            interactive: true,
            prompt,
            runInstall,
            workspaceRoot: "/ws",
        });

        expect(loaded).toBe(stub);
        expect(prompt).toHaveBeenCalledTimes(1);
        expect(runInstall).toHaveBeenCalledWith("@gitbeaker/rest", "/ws");
        expect(importImpl).toHaveBeenCalledTimes(2);
    });

    it("should throw when the user declines the install prompt", async () => {
        expect.assertions(2);

        const importImpl = vi.fn(async (specifier: OptionalSdk) => {
            throw moduleNotFound(specifier);
        });
        const prompt = vi.fn(async () => false);
        const runInstall = vi.fn(async () => {
            return { exitCode: 0 };
        });

        await expect(
            loadOptionalSdk("@octokit/rest", {
                importImpl,
                interactive: true,
                prompt,
                runInstall,
            }),
        ).rejects.toThrow(/install declined/);

        expect(runInstall).not.toHaveBeenCalled();
    });

    it("should throw when the install spawn exits non-zero", async () => {
        expect.assertions(1);

        const importImpl = vi.fn(async (specifier: OptionalSdk) => {
            throw moduleNotFound(specifier);
        });

        await expect(
            loadOptionalSdk("@octokit/rest", {
                importImpl,
                interactive: true,
                prompt: async () => true,
                runInstall: async () => {
                    return { exitCode: 1 };
                },
            }),
        ).rejects.toThrow(/Install of @octokit\/rest failed/);
    });

    it("should bubble unexpected errors verbatim instead of treating them as missing modules", async () => {
        expect.assertions(2);

        const boom = new SyntaxError("Unexpected token in @octokit/rest's index.js");
        const importImpl = vi.fn(async () => {
            throw boom;
        });

        await expect(
            loadOptionalSdk("@octokit/rest", {
                importImpl,
                interactive: false,
            }),
        ).rejects.toBe(boom);

        // No retry, no install. The user has a broken install — don't
        // mask that with a fresh `pnpm add`.
        expect(importImpl).toHaveBeenCalledTimes(1);
    });

    it("should also accept the legacy `MODULE_NOT_FOUND` code (CJS error shape)", async () => {
        expect.assertions(1);

        const importImpl = vi.fn(async (_specifier: OptionalSdk) => {
            const error: NodeJS.ErrnoException = new Error("Cannot find module");

            error.code = "MODULE_NOT_FOUND";

            throw error;
        });

        await expect(
            loadOptionalSdk("@octokit/rest", {
                importImpl,
                interactive: false,
            }),
        ).rejects.toThrow(/not installed/);
    });
});
