import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pail } from "../../../src/io/logger";
import {
    serviceListExecute,
    serviceLogsExecute,
    serviceRestartExecute,
    serviceStartExecute,
    serviceStatusExecute,
    serviceStopExecute,
} from "../../../src/commands/service/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

interface ToolboxShape {
    argument: (string | undefined)[];
    logger: { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
    options: Record<string, unknown>;
    visConfig: Record<string, unknown> | undefined;
    workspaceRoot: string | undefined;
}

const buildToolbox = (overrides: Partial<ToolboxShape> = {}): ToolboxShape => {
    return {
        argument: [],
        logger: { error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() },
        options: {},
        visConfig: undefined,
        workspaceRoot: "/tmp/ws-not-used",
        ...overrides,
    };
};

describe("commands/service/handler — argument validation", () => {
    let workspaceRoot: string;
    let homeOverride: string;
    let originalHome: string | undefined;
    let originalExitCode: number | string | undefined;
    let pailErrorSpy: ReturnType<typeof vi.spyOn>;
    let pailInfoSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-handler-ws-");
        homeOverride = createTemporaryDirectory("vis-handler-home-");
        originalHome = process.env["HOME"];
        process.env["HOME"] = homeOverride;
        originalExitCode = process.exitCode;
        process.exitCode = 0;

        // Silence + capture pail so test output stays clean and we can
        // assert on the messages that prove the validation path fired.
        pailErrorSpy = vi.spyOn(pail, "error").mockImplementation(() => undefined as never);
        pailInfoSpy = vi.spyOn(pail, "info").mockImplementation(() => undefined as never);
    });

    afterEach(() => {
        if (originalHome === undefined) {
            delete process.env["HOME"];
        } else {
            process.env["HOME"] = originalHome;
        }

        process.exitCode = originalExitCode;
        cleanupTemporaryDirectory(workspaceRoot);
        cleanupTemporaryDirectory(homeOverride);
        vi.restoreAllMocks();
    });

    describe(serviceStopExecute, () => {
        it("rejects --all combined with a positional id", async () => {
            expect.assertions(2);

            await serviceStopExecute(buildToolbox({ argument: ["pkg:db"], options: { all: true }, workspaceRoot }) as never);

            expect(process.exitCode).toBe(1);
            expect(pailErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Cannot combine --all with a target id"));
        });

        it("reports nothing-to-stop when --all runs against an empty workspace", async () => {
            expect.assertions(2);

            await serviceStopExecute(buildToolbox({ options: { all: true }, workspaceRoot }) as never);

            expect(process.exitCode).toBe(0);
            expect(pailInfoSpy).toHaveBeenCalledWith(expect.stringContaining("No running services registered"));
        });

        it("errors when neither --all nor a target id is provided", async () => {
            expect.assertions(2);

            await serviceStopExecute(buildToolbox({ workspaceRoot }) as never);

            expect(process.exitCode).toBe(1);
            expect(pailErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Missing target id"));
        });

        it("treats whitespace-only positional id as missing", async () => {
            expect.assertions(2);

            // Trim normalizes whitespace; an all-whitespace argument
            // collapses to empty and triggers the missing-id branch
            // rather than a misleading "service not registered" path.
            await serviceStopExecute(buildToolbox({ argument: ["   "], workspaceRoot }) as never);

            expect(process.exitCode).toBe(1);
            expect(pailErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Missing target id"));
        });
    });

    describe(serviceListExecute, () => {
        it("rejects an invalid --format value", async () => {
            expect.assertions(2);

            await serviceListExecute(buildToolbox({ options: { format: "yaml" }, workspaceRoot }) as never);

            expect(process.exitCode).toBe(1);
            expect(pailErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid --format"));
        });

        it("accepts --format=json without erroring", async () => {
            expect.assertions(1);

            // No services → empty JSON array on stdout, no pail.error.
            const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);

            await serviceListExecute(buildToolbox({ options: { format: "json" }, workspaceRoot }) as never);

            stdoutSpy.mockRestore();
            expect(pailErrorSpy).not.toHaveBeenCalled();
        });
    });

    describe("missing-id paths", () => {
        it("serviceStartExecute errors without a target id", async () => {
            expect.assertions(2);

            await serviceStartExecute(buildToolbox({ workspaceRoot }) as never);

            expect(process.exitCode).toBe(1);
            expect(pailErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Missing target id"));
        });

        it("serviceStatusExecute errors without a target id", async () => {
            expect.assertions(2);

            await serviceStatusExecute(buildToolbox({ workspaceRoot }) as never);

            expect(process.exitCode).toBe(1);
            expect(pailErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Missing target id"));
        });

        it("serviceRestartExecute errors without a target id", async () => {
            expect.assertions(2);

            await serviceRestartExecute(buildToolbox({ workspaceRoot }) as never);

            expect(process.exitCode).toBe(1);
            expect(pailErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Missing target id"));
        });

        it("serviceLogsExecute errors without a target id", async () => {
            expect.assertions(2);

            await serviceLogsExecute(buildToolbox({ workspaceRoot }) as never);

            expect(process.exitCode).toBe(1);
            expect(pailErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Missing target id"));
        });
    });

    describe("workspace-root requirement", () => {
        it("throws when invoked outside any workspace", async () => {
            expect.assertions(1);

            await expect(serviceStartExecute(buildToolbox({ argument: ["pkg:db"], workspaceRoot: undefined }) as never)).rejects.toThrow(/workspace root/i);
        });
    });
});
