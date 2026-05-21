import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VisConfig } from "../../../src/config/types";
import type { PolicyInput } from "../../../src/security/policies";
import { evaluatePublisherChangePolicy } from "../../../src/security/policies/publisher-change";

let homeOverride: string;

vi.mock(import("node:os"), async (importOriginal) => {
    const actual = await importOriginal();

    return { ...actual, homedir: () => homeOverride };
});

const { clearPackumentCache } = await import("../../../src/security/marshalls/packument");

const stubFetch = (body: unknown): ReturnType<typeof vi.fn> => {
    const handler = vi.fn(async () => {
        return {
            json: async () => body,
            ok: true,
            status: 200,
        };
    });

    vi.stubGlobal("fetch", handler);

    return handler;
};

interface VersionShape {
    hasProvenance?: boolean;
    publishedAt?: string;
}

const packument = (name: string, versions: Record<string, VersionShape>): Record<string, unknown> => {
    return {
        name,
        time: Object.fromEntries(
            Object.entries(versions)
                .filter(([, v]) => v.publishedAt !== undefined)
                .map(([version, v]) => [version, v.publishedAt]),
        ),
        versions: Object.fromEntries(
            Object.entries(versions).map(([version, v]) => [version, v.hasProvenance ? { dist: { attestations: { provenance: {} } }, version } : { version }]),
        ),
    };
};

const buildInput = (workspaceRoot: string): PolicyInput => {
    return {
        offline: false,
        packageManager: "npm",
        packages: [{ isDev: false, name: "evil", version: "2.0.0" }],
        workspaceRoot,
    };
};

describe(evaluatePublisherChangePolicy, () => {
    let workspaceRoot: string;

    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-pubchange-home-"));
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-pubchange-ws-"));
    });

    afterEach(() => {
        clearPackumentCache();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        rmSync(homeOverride, { force: true, recursive: true });
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("emits nothing when mode is not no-downgrade", async () => {
        expect.assertions(2);

        await expect(evaluatePublisherChangePolicy(buildInput(workspaceRoot), {})).resolves.toStrictEqual([]);
        await expect(
            evaluatePublisherChangePolicy(buildInput(workspaceRoot), {
                security: { policies: { publisherChange: { mode: "warn-only" } } },
            } as unknown as VisConfig),
        ).resolves.toStrictEqual([]);
    });

    it("blocks a version that dropped provenance carried by a prior version", async () => {
        expect.assertions(4);

        stubFetch(packument("evil", { "1.0.0": { hasProvenance: true }, "2.0.0": { hasProvenance: false } }));

        const decisions = await evaluatePublisherChangePolicy(buildInput(workspaceRoot), {
            security: { policies: { publisherChange: { mode: "no-downgrade" } } },
        });

        expect(decisions).toHaveLength(1);
        expect(decisions[0]?.severity).toBe("block");
        expect(decisions[0]?.policy).toBe("publisherChange");
        expect(decisions[0]?.data).toStrictEqual({ priorVersionWithProvenance: "1.0.0" });
    });

    it("allows when the resolved version itself carries provenance", async () => {
        expect.assertions(1);

        stubFetch(packument("evil", { "1.0.0": { hasProvenance: true }, "2.0.0": { hasProvenance: true } }));

        const decisions = await evaluatePublisherChangePolicy(buildInput(workspaceRoot), {
            security: { policies: { publisherChange: { mode: "no-downgrade" } } },
        });

        expect(decisions).toStrictEqual([]);
    });

    it("allows when no prior version ever carried provenance", async () => {
        expect.assertions(1);

        stubFetch(packument("evil", { "1.0.0": { hasProvenance: false }, "2.0.0": { hasProvenance: false } }));

        const decisions = await evaluatePublisherChangePolicy(buildInput(workspaceRoot), {
            security: { policies: { publisherChange: { mode: "no-downgrade" } } },
        });

        expect(decisions).toStrictEqual([]);
    });

    it("honors an exclude glob", async () => {
        expect.assertions(1);

        stubFetch(packument("evil", { "1.0.0": { hasProvenance: true }, "2.0.0": { hasProvenance: false } }));

        const decisions = await evaluatePublisherChangePolicy(buildInput(workspaceRoot), {
            security: { policies: { publisherChange: { exclude: ["ev*"], mode: "no-downgrade" } } },
        });

        expect(decisions).toStrictEqual([]);
    });

    it("skips a version published longer ago than ignoreAfter", async () => {
        expect.assertions(1);

        const old = new Date(Date.now() - 10 * 24 * 60 * 60_000).toISOString(); // 10 days ago

        stubFetch(
            packument("evil", {
                "1.0.0": { hasProvenance: true },
                "2.0.0": { hasProvenance: false, publishedAt: old },
            }),
        );

        const decisions = await evaluatePublisherChangePolicy(buildInput(workspaceRoot), {
            security: { policies: { publisherChange: { ignoreAfter: 60, mode: "no-downgrade" } } },
        });

        expect(decisions).toStrictEqual([]);
    });
});
