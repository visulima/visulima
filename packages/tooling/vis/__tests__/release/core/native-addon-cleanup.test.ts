/**
 * Regression test for the OIDC-token-bearing temp-dir cleanup added by
 * the security audit (RFC §19.4 finding #2).
 *
 * Strategy: stub `node:child_process.execFileSync` to throw, then call
 * `publish()` against a minimal NAPI workspace. After the rejection
 * we sweep the OS tmpdir and assert no `vis-release-napi-*` directories
 * created during the run survive — the finally block must wipe them.
 */

import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import { NativeAddonVersionActions } from "../../../src/release/core/version-actions/native-addon";
import type { WorkspacePackage } from "../../../src/release/types";

vi.mock(import("node:child_process"), () => {
    return {
        execFileSync: vi.fn(() => {
            throw new Error("simulated npm publish failure");
        }),
    };
});

const listTempVisDirs = (): string[] => readdirSync(tmpdir()).filter((n) => n.startsWith("vis-release-napi-"));

describe("native-addon: temp-dir cleanup on failure (RFC §19.4)", () => {
    let workspace: string;
    let baseline: Set<string>;
    let originalFetch: typeof globalThis.fetch;
    let originalReqUrl: string | undefined;
    let originalReqToken: string | undefined;

    beforeEach(() => {
        workspace = mkdtempSync(join(tmpdir(), "vis-na-test-"));
        baseline = new Set(listTempVisDirs());

        const parentManifest = {
            name: "@scope/parent",
            napi: { binaryName: "parent" },
            optionalDependencies: { "@scope/parent-linux-x64": "1.0.0" },
            version: "1.0.0",
        };

        writeFileSync(join(workspace, "package.json"), JSON.stringify(parentManifest));
        mkdirSync(join(workspace, "npm", "linux-x64"), { recursive: true });
        writeFileSync(
            join(workspace, "npm", "linux-x64", "package.json"),
            JSON.stringify({ name: "@scope/parent-linux-x64", version: "1.0.0" }),
        );

        // Force the OIDC exchange to succeed so we reach the temp-dir-creating branch.
        originalFetch = globalThis.fetch;
        globalThis.fetch = (async () => Response.json(
            { token: "fake-pkg-token", value: "fake-id-token" },
            { status: 200 },
        ));

        originalReqUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
        originalReqToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
        process.env.ACTIONS_ID_TOKEN_REQUEST_URL = "https://example/oidc";
        process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = "ci-token";
    });

    afterEach(() => {
        rmSync(workspace, { force: true, recursive: true });

        // Belt-and-braces: sweep any leftover dirs we missed.
        for (const dir of listTempVisDirs()) {
            if (!baseline.has(dir)) {
                rmSync(join(tmpdir(), dir), { force: true, recursive: true });
            }
        }

        globalThis.fetch = originalFetch;

        if (originalReqUrl === undefined) {
            delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
        } else {
            process.env.ACTIONS_ID_TOKEN_REQUEST_URL = originalReqUrl;
        }

        if (originalReqToken === undefined) {
            delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
        } else {
            process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = originalReqToken;
        }
    });

    it("removes every mkdtemp dir even when publish throws", async () => {
        const pkg: WorkspacePackage = {
            dir: workspace,
            manifest: {
                name: "@scope/parent",
                napi: { binaryName: "parent" },
                optionalDependencies: { "@scope/parent-linux-x64": "1.0.0" },
                version: "1.0.0",
            },
            manifestPath: join(workspace, "package.json"),
            name: "@scope/parent",
            private: false,
            version: "1.0.0",
        };

        const ctx = {
            catalogs: undefined,
            dryRun: false,
            pkg,
            pm: { id: "pnpm" },
            provenance: false,
            release: {
                isCascadeBump: false,
                isDependencyBump: false,
                isGroupBump: false,
                name: "@scope/parent",
                newVersion: "1.1.0",
                oldVersion: "1.0.0",
                type: "minor",
            },
            tag: "latest",
            versionedManifestByName: new Map([[pkg.name, pkg.manifest]]),
        } as unknown as PublishContext;

        const actions = new NativeAddonVersionActions();

        await expect(actions.publish(ctx)).rejects.toThrow();

        const leaked = listTempVisDirs().filter((d) => !baseline.has(d));

        expect(leaked).toEqual([]);
    });
});
