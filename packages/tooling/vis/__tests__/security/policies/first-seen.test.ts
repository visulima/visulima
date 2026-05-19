import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VisConfig } from "../../../src/config/types";
import type { PolicyInput } from "../../../src/security/policies";
import { evaluateFirstSeenPolicy } from "../../../src/security/policies/first-seen";

let homeOverride: string;

vi.mock(import("node:os"), async (importOriginal) => {
    const actual = await importOriginal();

    return { ...actual, homedir: () => homeOverride };
});

const { clearPackumentCache } = await import("../../../src/security/marshalls/packument");

const stubFetch = (body: unknown): ReturnType<typeof vi.fn> => {
    const handler = vi.fn(async () => ({
        json: async () => body,
        ok: true,
        status: 200,
    }));

    vi.stubGlobal("fetch", handler);

    return handler;
};

const packument = (name: string, time: Record<string, string>): Record<string, unknown> => ({
    name,
    time,
    versions: Object.fromEntries(Object.keys(time).map((v) => [v, { version: v }])),
});

const buildInput = (workspaceRoot: string): PolicyInput => ({
    offline: false,
    packageManager: "npm",
    packages: [{ isDev: false, name: "evil", version: "1.0.0" }],
    workspaceRoot,
});

describe(evaluateFirstSeenPolicy, () => {
    let workspaceRoot: string;

    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-firstseen-home-"));
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-firstseen-ws-"));
    });

    afterEach(() => {
        clearPackumentCache();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        rmSync(homeOverride, { force: true, recursive: true });
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("emits nothing when firstSeen.minutes is unset or zero", async () => {
        expect.assertions(2);

        expect(await evaluateFirstSeenPolicy(buildInput(workspaceRoot), {})).toStrictEqual([]);
        expect(
            await evaluateFirstSeenPolicy(buildInput(workspaceRoot), { security: { policies: { firstSeen: { minutes: 0 } } } } as VisConfig),
        ).toStrictEqual([]);
    });

    it("blocks a version published inside the cooldown window", async () => {
        expect.assertions(3);

        const publishedAt = new Date(Date.now() - 30 * 60_000).toISOString(); // 30 min ago

        stubFetch(packument("evil", { "1.0.0": publishedAt }));

        const decisions = await evaluateFirstSeenPolicy(buildInput(workspaceRoot), {
            security: { policies: { firstSeen: { minutes: 1440 } } },
        });

        expect(decisions).toHaveLength(1);
        expect(decisions[0]?.severity).toBe("block");
        expect(decisions[0]?.policy).toBe("firstSeen");
    });

    it("allows a version older than the cooldown window", async () => {
        expect.assertions(1);

        const publishedAt = new Date(Date.now() - 5 * 24 * 60 * 60_000).toISOString(); // 5 days ago

        stubFetch(packument("evil", { "1.0.0": publishedAt }));

        const decisions = await evaluateFirstSeenPolicy(buildInput(workspaceRoot), {
            security: { policies: { firstSeen: { minutes: 1440 } } },
        });

        expect(decisions).toStrictEqual([]);
    });

    it("honors an exclude glob", async () => {
        expect.assertions(1);

        const publishedAt = new Date(Date.now() - 1000).toISOString();

        stubFetch(packument("evil", { "1.0.0": publishedAt }));

        const decisions = await evaluateFirstSeenPolicy(buildInput(workspaceRoot), {
            security: { policies: { firstSeen: { exclude: ["ev*"], minutes: 1440 } } },
        });

        expect(decisions).toStrictEqual([]);
    });
});
