import { describe, expect, it } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import { refuseRestrictedOidc, waitForStageDecision } from "../../../src/release/core/stage-publisher";
import { VisReleaseError } from "../../../src/release/errors";

interface RecordedCall {
    args: ReadonlyArray<string>;
    command: string;
}

const buildRunner = (
    responses: { args?: ReadonlyArray<string>; exitCode?: number; stdout?: string }[],
): { calls: RecordedCall[]; runner: CommandRunner } => {
    const calls: RecordedCall[] = [];
    let cursor = 0;

    const runner: CommandRunner = {
        run: async (command, args) => {
            calls.push({ args, command });

            const next = responses[cursor];

            cursor += 1;

            return next
                ? { exitCode: next.exitCode ?? 0, stderr: "", stdout: next.stdout ?? "" }
                : { exitCode: 1, stderr: "no more stub responses", stdout: "" };
        },
    };

    return { calls, runner };
};

describe(waitForStageDecision, () => {
    it("returns 'approved' when the stage view 404s and `npm view` reports the version live", async () => {
        const { calls, runner } = buildRunner([
            // First poll: still staged.
            { stdout: JSON.stringify({ id: "stage-xyz", package: "x", version: "1.0.0" }) },
            // Second poll: decision made (stage view 404).
            { exitCode: 1, stdout: "" },
            // npm view disambiguation: published → returns a tarball URL.
            { exitCode: 0, stdout: "https://registry.npmjs.org/x/-/x-1.0.0.tgz" },
        ]);

        const decision = await waitForStageDecision({
            cwd: "/cwd",
            packageName: "x",
            pollIntervalMs: 1,
            runner,
            stageId: "stage-xyz",
            timeoutMs: 5000,
            version: "1.0.0",
        });

        expect(decision).toBe("approved");
        expect(calls).toHaveLength(3);
        expect(calls[0]!.args).toContain("stage");
        expect(calls[0]!.args).toContain("view");
        expect(calls[2]!.args).toContain("x@1.0.0");
    });

    it("returns 'rejected' when the stage record is gone and the version isn't on the registry", async () => {
        const { runner } = buildRunner([
            // First poll: empty stdout → decision made.
            { exitCode: 0, stdout: "" },
            // npm view: 404 / no tarball URL.
            { exitCode: 1, stdout: "" },
        ]);

        const decision = await waitForStageDecision({
            cwd: "/cwd",
            packageName: "x",
            pollIntervalMs: 1,
            runner,
            stageId: "stage-xyz",
            timeoutMs: 5000,
            version: "1.0.0",
        });

        expect(decision).toBe("rejected");
    });

    it("returns 'timeout' when timeoutMs elapses with the stage record still present", async () => {
        // Every poll returns "still staged".
        const responses = Array.from({ length: 20 }, () => {
            return {
                stdout: JSON.stringify({ id: "stage-xyz", package: "x", version: "1.0.0" }),
            };
        });
        const { runner } = buildRunner(responses);

        const decision = await waitForStageDecision({
            cwd: "/cwd",
            packageName: "x",
            pollIntervalMs: 1,
            runner,
            stageId: "stage-xyz",
            timeoutMs: 20,
            version: "1.0.0",
        });

        expect(decision).toBe("timeout");
    });

    it("fires onProgress while polling", async () => {
        const responses = [
            { stdout: JSON.stringify({ id: "stage-xyz" }) },
            { stdout: JSON.stringify({ id: "stage-xyz" }) },
            { exitCode: 0, stdout: "" },
            { exitCode: 0, stdout: "https://registry/x.tgz" },
        ];
        const { runner } = buildRunner(responses);
        const elapsed: number[] = [];

        await waitForStageDecision({
            cwd: "/cwd",
            onProgress: (ms) => elapsed.push(ms),
            packageName: "x",
            pollIntervalMs: 1,
            runner,
            stageId: "stage-xyz",
            timeoutMs: 5000,
            version: "1.0.0",
        });

        expect(elapsed.length).toBeGreaterThanOrEqual(2);
    });
});

describe(refuseRestrictedOidc, () => {
    it("throws CONFIG_INVALID when both restricted + OIDC are present", () => {
        const env = { ACTIONS_ID_TOKEN_REQUEST_URL: "https://example/oidc" };

        expect(() => { refuseRestrictedOidc("restricted", env); }).toThrow(VisReleaseError);
        expect(() => { refuseRestrictedOidc("restricted", env); }).toThrow(/restricted-access/);
    });

    it("passes when only OIDC is set (public package)", () => {
        const env = { ACTIONS_ID_TOKEN_REQUEST_URL: "https://example/oidc" };

        expect(() => { refuseRestrictedOidc("public", env); }).not.toThrow();
        expect(() => { refuseRestrictedOidc(undefined, env); }).not.toThrow();
    });

    it("passes when only restricted is set (no OIDC)", () => {
        expect(() => { refuseRestrictedOidc("restricted", {}); }).not.toThrow();
    });

    it("passes when NPM_TOKEN is also set alongside OIDC (operator has the fallback)", () => {
        const env = {
            ACTIONS_ID_TOKEN_REQUEST_URL: "https://example/oidc",
            NPM_TOKEN: "npm_xxx",
        };

        expect(() => { refuseRestrictedOidc("restricted", env); }).not.toThrow();
    });
});
