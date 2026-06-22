/**
 * Tests for `JsrVersionActions` — the first-class jsr.io publisher.
 *
 * The plugin has three integration points worth covering:
 *
 *   1. **JSR manifest parsing** (`jsr.json` / `deno.json`) — JSR's
 *      scoped-name rule is enforced at parse time so a misconfigured
 *      manifest fails LOUDLY (CONFIG_INVALID) at preflight rather than
 *      producing a cryptic `jsr publish` error.
 *
 *   2. **jsr.io published-version detection** — the meta.json fetch
 *      returns `latest` on 200, swallows network failures + 404 into
 *      `undefined`, leaving the orchestrator's "publish anyway" path
 *      to trigger safely.
 *
 *   3. **publish() end-to-end** — exercises the `npx jsr publish`
 *      invocation, OIDC detection, idempotency short-circuit, and
 *      AUTH_MISSING preflight.
 *
 * Every test stubs both `globalThis.fetch` AND a mock runner — nothing
 * touches the real network or real jsr CLI.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import { __testing, JsrVersionActions } from "../../../src/release/core/version-actions/jsr";
import { jsr } from "../../../src/release/presets";

const writeJsrManifest = (dir: string, file: string, body: unknown): string => {
    const path = join(dir, file);

    writeFileSync(path, JSON.stringify(body, null, 2));

    return path;
};

interface RunCall {
    args: ReadonlyArray<string>;
    command: string;
    cwd: string;
}

const buildRunner = (
    responses: { exitCode?: number; stderr?: string; stdout?: string }[],
): { calls: RunCall[]; runner: CommandRunner } => {
    const calls: RunCall[] = [];
    let cursor = 0;

    const runner: CommandRunner = {
        run: async (command, args, options) => {
            calls.push({ args, command, cwd: options.cwd });

            const next = responses[cursor];

            cursor += 1;

            return next
                ? { exitCode: next.exitCode ?? 0, stderr: next.stderr ?? "", stdout: next.stdout ?? "" }
                : { exitCode: 0, stderr: "", stdout: "" };
        },
    };

    return { calls, runner };
};

const stubFetch = (response: { body?: unknown; ok?: boolean; status?: number; throws?: boolean }): ReturnType<typeof vi.fn> => {
    const fn = vi.fn(async () => {
        if (response.throws) {
            throw new Error("network unreachable");
        }

        const status = response.status ?? 200;

        return {
            json: async () => response.body ?? {},
            ok: response.ok ?? (status >= 200 && status < 300),
            status,
        } as unknown as Response;
    });

    globalThis.fetch = fn;

    return fn;
};

const ctx = (overrides: {
    dir: string;
    dryRun?: boolean;
    jsrConfigPath?: string;
    jsrPublishArgs?: string[];
    newVersion?: string;
    pkgName?: string;
    runner?: CommandRunner;
    workspaceConfig?: Record<string, unknown>;
}): PublishContext => {
    return {
        catalogs: {} as never,
        dryRun: overrides.dryRun,
        perPackageConfig: {
            jsrConfigPath: overrides.jsrConfigPath,
            jsrPublishArgs: overrides.jsrPublishArgs,
        },
        pkg: {
            dir: overrides.dir,
            manifest: { name: overrides.pkgName ?? "@scope/sdk-jsr", version: "1.0.0" },
            manifestPath: join(overrides.dir, "package.json"),
            name: overrides.pkgName ?? "@scope/sdk-jsr",
            private: false,
            version: "1.0.0",
        },
        pm: {
            id: "npm" as const,
            minVersion: "8.0.0",
            runner: overrides.runner ?? buildRunner([]).runner,
        } as never,
        release: {
            changeFiles: [],
            isCascadeBump: false,
            isDependencyBump: false,
            isGroupBump: false,
            name: overrides.pkgName ?? "@scope/sdk-jsr",
            newVersion: overrides.newVersion ?? "1.0.1",
            oldVersion: "1.0.0",
            reasons: ["EXPLICIT"],
            sources: [],
            type: "patch" as const,
        } as never,
        versionedManifestByName: new Map(),
        workspaceConfig: (overrides.workspaceConfig ?? {}),
    };
};

let workspace: string;
let originalFetch: typeof globalThis.fetch;
let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "vis-jsr-test-"));
    originalFetch = globalThis.fetch;
    originalEnv = { ...process.env };
    // Wipe ambient auth so tests don't depend on the dev machine's env.
    delete process.env["JSR_API_KEY"];
    delete process.env["ACTIONS_ID_TOKEN_REQUEST_URL"];
    delete process.env["ACTIONS_ID_TOKEN_REQUEST_TOKEN"];
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
});

describe("jsrVersionActions: identity", () => {
    it("has stable id `jsr`", () => {
        expect.hasAssertions();
        expect(new JsrVersionActions().id).toBe("jsr");
    });
});

describe("jsrVersionActions: readPublishedVersion", () => {
    it("returns jsr.io `latest` on the 200 happy path", async () => {
        // Manifest must be present so the actions can resolve the JSR
        // package name (it's not the JS package.json name — JSR uses
        // its own scoped identifier in jsr.json).
        expect.hasAssertions();

        writeJsrManifest(workspace, "jsr.json", { name: "@acme/sdk", version: "1.0.0" });
        const fetchSpy = stubFetch({ body: { latest: "1.2.3", versions: { "1.0.0": {}, "1.2.3": {} } } });

        const result = await new JsrVersionActions().readPublishedVersion({
            pkg: { dir: workspace, name: "@scope/sdk-jsr" } as never,
            pm: { runner: buildRunner([]).runner } as never,
        });

        expect(result).toBe("1.2.3");

        // Verify the URL targets jsr.io's meta.json endpoint with the
        // manifest's scoped name (NOT the JS package name).
        const calledUrl = fetchSpy.mock.calls[0]![0] as string;

        expect(calledUrl).toBe("https://jsr.io/@acme/sdk/meta.json");
    });

    it("returns undefined on 404 (package never published)", async () => {
        expect.hasAssertions();

        writeJsrManifest(workspace, "jsr.json", { name: "@acme/fresh", version: "0.1.0" });
        stubFetch({ ok: false, status: 404 });

        const result = await new JsrVersionActions().readPublishedVersion({
            pkg: { dir: workspace, name: "@scope/sdk-jsr" } as never,
            pm: { runner: buildRunner([]).runner } as never,
        });

        expect(result).toBeUndefined();
    });

    it("returns undefined when fetch throws (network unreachable)", async () => {
        expect.hasAssertions();

        writeJsrManifest(workspace, "jsr.json", { name: "@acme/sdk", version: "1.0.0" });
        stubFetch({ throws: true });

        const result = await new JsrVersionActions().readPublishedVersion({
            pkg: { dir: workspace, name: "@scope/sdk-jsr" } as never,
            pm: { runner: buildRunner([]).runner } as never,
        });

        expect(result).toBeUndefined();
    });

    it("returns undefined when manifest is unreadable (preserves publish-anyway path)", async () => {
        // No jsr.json at the workspace.
        expect.hasAssertions();

        stubFetch({ body: { latest: "1.0.0" } });

        const result = await new JsrVersionActions().readPublishedVersion({
            pkg: { dir: workspace, name: "@scope/sdk-jsr" } as never,
            pm: { runner: buildRunner([]).runner } as never,
        });

        expect(result).toBeUndefined();
    });

    it("stamps a vis-release User-Agent on jsr.io metadata requests (B-3 parity)", async () => {
        expect.hasAssertions();

        writeJsrManifest(workspace, "jsr.json", { name: "@acme/sdk", version: "1.0.0" });
        const fetchSpy = stubFetch({ body: { latest: "1.0.0" } });

        await new JsrVersionActions().readPublishedVersion({
            pkg: { dir: workspace, name: "@scope/sdk-jsr" } as never,
            pm: { runner: buildRunner([]).runner } as never,
        });

        const init = fetchSpy.mock.calls[0]![1] as RequestInit | undefined;
        const headers = init?.headers as Record<string, string> | undefined;

        expect(headers).toBeDefined();
        expect(headers!["User-Agent"]).toMatch(/^vis-release\//);
    });
});

describe("jsrVersionActions: parseJsrManifest", () => {
    it("parses a valid @scope/name + version", async () => {
        expect.hasAssertions();

        const path = writeJsrManifest(workspace, "jsr.json", { name: "@acme/sdk", version: "2.5.1" });
        const result = await __testing.parseJsrManifest(path);

        expect(result).toStrictEqual({ name: "@acme/sdk", version: "2.5.1" });
    });

    it("parses a deno.json manifest (same shape as jsr.json for the fields we read)", async () => {
        expect.hasAssertions();

        const path = writeJsrManifest(workspace, "deno.json", {
            exports: "./mod.ts",
            name: "@acme/deno-pkg",
            tasks: { test: "deno test" },
            version: "0.3.0",
        });

        const result = await __testing.parseJsrManifest(path);

        expect(result).toStrictEqual({ name: "@acme/deno-pkg", version: "0.3.0" });
    });

    it("throws CONFIG_INVALID when name has no @scope/ prefix (JSR refuses unscoped publishes)", async () => {
        expect.hasAssertions();

        const path = writeJsrManifest(workspace, "jsr.json", { name: "no-scope", version: "1.0.0" });

        await expect(__testing.parseJsrManifest(path)).rejects.toMatchObject({
            code: "CONFIG_INVALID",
            file: path,
            hint: expect.stringContaining("@scope/name"),
        });
    });

    it("throws CONFIG_INVALID when name is missing entirely", async () => {
        expect.hasAssertions();

        const path = writeJsrManifest(workspace, "jsr.json", { version: "1.0.0" });

        await expect(__testing.parseJsrManifest(path)).rejects.toMatchObject({
            code: "CONFIG_INVALID",
            file: path,
        });
    });

    it("throws CONFIG_INVALID when version is missing", async () => {
        expect.hasAssertions();

        const path = writeJsrManifest(workspace, "jsr.json", { name: "@acme/sdk" });

        await expect(__testing.parseJsrManifest(path)).rejects.toMatchObject({
            code: "CONFIG_INVALID",
            file: path,
        });
    });

    it("throws CONFIG_INVALID when the file is missing entirely", async () => {
        expect.hasAssertions();
        await expect(__testing.parseJsrManifest(join(workspace, "no-such-file.json"))).rejects.toMatchObject({
            code: "CONFIG_INVALID",
        });
    });

    it("throws CONFIG_INVALID on malformed JSON", async () => {
        expect.hasAssertions();

        const path = join(workspace, "jsr.json");

        writeFileSync(path, "{ not valid json ");

        await expect(__testing.parseJsrManifest(path)).rejects.toMatchObject({
            code: "CONFIG_INVALID",
            file: path,
        });
    });
});

describe("jsrVersionActions: shouldUseTrustedPublishing", () => {
    it("returns true with OIDC env + no static token", () => {
        expect.hasAssertions();
        expect(__testing.shouldUseTrustedPublishing({
            ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.com",
        })).toBe(true);
    });

    it("returns true even when JSR_API_KEY is set (OIDC wins by default)", () => {
        // Aligned with cargo / python: OIDC env presence means the
        // operator wired up trusted publishing; a leftover static token
        // shouldn't silently downgrade.
        expect.hasAssertions();
        expect(__testing.shouldUseTrustedPublishing({
            ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.com",
            JSR_API_KEY: "jsr_abc123",
        })).toBe(true);
    });

    it("returns false when preferStaticToken: true AND a static token is set (escape hatch)", () => {
        expect.hasAssertions();
        expect(__testing.shouldUseTrustedPublishing(
            {
                ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.com",
                JSR_API_KEY: "jsr_abc123",
            },
            { publish: { preferStaticToken: true } },
        )).toBe(false);
    });

    it("returns false without OIDC env (developer machine, no key)", () => {
        expect.hasAssertions();
        expect(__testing.shouldUseTrustedPublishing({})).toBe(false);
    });
});

describe("jsrVersionActions: publish — dryRun", () => {
    it("returns published: true without invoking npx or fetch", async () => {
        expect.hasAssertions();

        writeJsrManifest(workspace, "jsr.json", { name: "@acme/sdk", version: "1.0.1" });
        const { calls, runner } = buildRunner([]);
        const fetchSpy = stubFetch({ body: {} });

        const result = await new JsrVersionActions().publish(ctx({
            dir: workspace,
            dryRun: true,
            runner,
        }));

        expect(result.published).toBe(true);
        expect(result.output).toContain("[dry-run / jsr]");
        expect(calls).toHaveLength(0);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe("jsrVersionActions: publish — happy path", () => {
    it("invokes `npx jsr publish --allow-dirty` when jsr.io has an older version", async () => {
        expect.hasAssertions();

        writeJsrManifest(workspace, "jsr.json", { name: "@acme/sdk", version: "1.0.1" });
        process.env["JSR_API_KEY"] = "jsr_dummy_static_token";
        stubFetch({ body: { latest: "1.0.0" } });

        const { calls, runner } = buildRunner([{ exitCode: 0, stdout: "uploaded" }]);
        const result = await new JsrVersionActions().publish(ctx({
            dir: workspace,
            runner,
        }));

        expect(result.published).toBe(true);
        expect(result.alreadyPublished).not.toBe(true);
        expect(calls).toHaveLength(1);
        expect(calls[0]!.command).toBe("npx");
        expect(calls[0]!.args).toStrictEqual(["jsr", "publish", "--allow-dirty"]);
    });

    it("flags OIDC trusted-publishing in the output when ACTIONS_ID_TOKEN_REQUEST_URL is set", async () => {
        expect.hasAssertions();

        writeJsrManifest(workspace, "jsr.json", { name: "@acme/sdk", version: "1.0.1" });
        process.env["ACTIONS_ID_TOKEN_REQUEST_URL"] = "https://token.actions.githubusercontent.com";
        process.env["ACTIONS_ID_TOKEN_REQUEST_TOKEN"] = "ghs_dummy";

        stubFetch({ body: { latest: "1.0.0" } });

        const { calls, runner } = buildRunner([{ exitCode: 0 }]);
        const result = await new JsrVersionActions().publish(ctx({
            dir: workspace,
            runner,
        }));

        expect(result.published).toBe(true);
        expect(result.output).toContain("trusted publishing");
        expect(calls[0]!.args).toStrictEqual(["jsr", "publish", "--allow-dirty"]);
    });

    it("forwards jsrPublishArgs (e.g. --allow-slow-types) after the built-in flags", async () => {
        expect.hasAssertions();

        writeJsrManifest(workspace, "jsr.json", { name: "@acme/sdk", version: "1.0.1" });
        process.env["JSR_API_KEY"] = "jsr_dummy";
        stubFetch({ body: { latest: "1.0.0" } });

        const { calls, runner } = buildRunner([{ exitCode: 0 }]);

        await new JsrVersionActions().publish(ctx({
            dir: workspace,
            jsrPublishArgs: ["--allow-slow-types"],
            runner,
        }));

        expect(calls[0]!.args).toStrictEqual(["jsr", "publish", "--allow-dirty", "--allow-slow-types"]);
    });

    it("passes --config when jsrConfigPath points at a non-default file (e.g. deno.json)", async () => {
        expect.hasAssertions();

        writeJsrManifest(workspace, "deno.json", { name: "@acme/deno-pkg", version: "1.0.1" });
        process.env["JSR_API_KEY"] = "jsr_dummy";
        stubFetch({ body: { latest: "1.0.0" } });

        const { calls, runner } = buildRunner([{ exitCode: 0 }]);

        await new JsrVersionActions().publish(ctx({
            dir: workspace,
            jsrConfigPath: "deno.json",
            pkgName: "@scope/deno-pkg",
            runner,
        }));

        expect(calls[0]!.args).toStrictEqual(["jsr", "publish", "--allow-dirty", "--config", "deno.json"]);
    });
});

describe("jsrVersionActions: publish — idempotency", () => {
    it("short-circuits with alreadyPublished when jsr.io latest === new version", async () => {
        expect.hasAssertions();

        writeJsrManifest(workspace, "jsr.json", { name: "@acme/sdk", version: "1.0.1" });
        process.env["JSR_API_KEY"] = "jsr_dummy";
        stubFetch({ body: { latest: "1.0.1" } });

        const { calls, runner } = buildRunner([]);
        const result = await new JsrVersionActions().publish(ctx({
            dir: workspace,
            runner,
        }));

        expect(result.alreadyPublished).toBe(true);
        expect(result.published).toBe(false);
        expect(result.output).toContain("already on jsr.io");
        expect(calls).toHaveLength(0);
    });
});

describe("jsrVersionActions: publish — failure modes", () => {
    it("throws AUTH_MISSING when neither JSR_API_KEY nor OIDC is available", async () => {
        expect.hasAssertions();

        writeJsrManifest(workspace, "jsr.json", { name: "@acme/sdk", version: "1.0.1" });
        stubFetch({ body: { latest: "1.0.0" } });

        await expect(new JsrVersionActions().publish(ctx({
            dir: workspace,
            runner: buildRunner([]).runner,
        }))).rejects.toMatchObject({ code: "AUTH_MISSING" });
    });

    it("throws CONFIG_INVALID when the manifest's name is unscoped", async () => {
        // The manifest gets past the read step (extra-files would
        // already have bumped it to newVersion in a real run); the
        // publish path re-validates and surfaces the scoped-name rule.
        expect.hasAssertions();

        writeJsrManifest(workspace, "jsr.json", { name: "unscoped", version: "1.0.1" });
        process.env["JSR_API_KEY"] = "jsr_dummy";
        stubFetch({ body: { latest: "1.0.0" } });

        await expect(new JsrVersionActions().publish(ctx({
            dir: workspace,
            runner: buildRunner([]).runner,
        }))).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("throws CONFIG_INVALID when manifest version differs from planned release version", async () => {
        // Simulates a misconfigured extra-files rule that didn't bump
        // the manifest — we want to publish 1.0.1 but disk says 1.0.0.
        expect.hasAssertions();

        writeJsrManifest(workspace, "jsr.json", { name: "@acme/sdk", version: "1.0.0" });
        process.env["JSR_API_KEY"] = "jsr_dummy";
        stubFetch({ body: { latest: "0.9.0" } });

        await expect(new JsrVersionActions().publish(ctx({
            dir: workspace,
            newVersion: "1.0.1",
            runner: buildRunner([]).runner,
        }))).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("throws PUBLISH_FAILED when jsr publish exits non-zero", async () => {
        expect.hasAssertions();

        writeJsrManifest(workspace, "jsr.json", { name: "@acme/sdk", version: "1.0.1" });
        process.env["JSR_API_KEY"] = "jsr_dummy";
        stubFetch({ body: { latest: "1.0.0" } });

        const { runner } = buildRunner([{ exitCode: 1, stderr: "error: 401 Unauthorized" }]);

        await expect(new JsrVersionActions().publish(ctx({
            dir: workspace,
            runner,
        }))).rejects.toMatchObject({ code: "PUBLISH_FAILED" });
    });
});

describe("jsr() preset integration", () => {
    it("returns a PerPackageReleaseConfig with versionActions: 'jsr' and matching jsrConfigPath", () => {
        expect.hasAssertions();

        const cfg = jsr();

        expect(cfg.versionActions).toBe("jsr");
        expect(cfg.jsrConfigPath).toBe("jsr.json");
        expect(cfg.extraFiles).toBeDefined();
        expect(cfg.extraFiles).toHaveLength(1);
        expect(cfg.extraFiles![0]!.path).toBe("jsr.json");
    });

    it("supports `manifestPath: 'deno.json'` for Deno-flavoured packages", () => {
        expect.hasAssertions();

        const cfg = jsr({ manifestPath: "deno.json" });

        expect(cfg.versionActions).toBe("jsr");
        expect(cfg.jsrConfigPath).toBe("deno.json");
        expect(cfg.extraFiles![0]!.path).toBe("deno.json");
    });

    it("emits a second extra-files rule against deno.json when `deno: true` is passed", () => {
        expect.hasAssertions();

        const cfg = jsr({ deno: true });

        expect(cfg.extraFiles).toHaveLength(2);
        expect(cfg.extraFiles![0]!.path).toBe("jsr.json");
        expect(cfg.extraFiles![1]!.path).toBe("deno.json");
    });

    it("does NOT duplicate the rule when `deno: true` is paired with `manifestPath: 'deno.json'`", () => {
        // Edge case: operator passed both flags. The manifestPath
        // already targets deno.json, so there's no second file to
        // rewrite — the preset must not emit a duplicate rule.
        expect.hasAssertions();

        const cfg = jsr({ deno: true, manifestPath: "deno.json" });

        expect(cfg.extraFiles).toHaveLength(1);
        expect(cfg.extraFiles![0]!.path).toBe("deno.json");
    });

    it("merges operator-supplied extraFiles after the manifest rule", () => {
        expect.hasAssertions();

        const cfg = jsr({
            extraFiles: [{ path: "src/version.ts", search: "VERSION = \"[^\"]+\"" }],
        });

        expect(cfg.extraFiles).toHaveLength(2);
        expect(cfg.extraFiles![0]!.path).toBe("jsr.json");
        expect(cfg.extraFiles![1]!.path).toBe("src/version.ts");
    });
});
