/**
 * Tests for the first-class `CargoVersionActions` plugin.
 *
 * The plugin has three integration points worth covering:
 *
 *   1. **Cargo.toml parsing** — pulled out into `__testing.readCargoToml`
 *      so a malformed file fails LOUDLY (CONFIG_INVALID) at preflight
 *      rather than producing a cryptic `cargo publish` error later.
 *
 *   2. **crates.io published-version detection** — `__testing
 *      .fetchCratesIoVersion` swallows network failures and 404s into
 *      `undefined`, surfacing only a 200+JSON happy path so the
 *      orchestrator's "publish anyway" path triggers safely.
 *
 *   3. **publish() end-to-end** — exercises the cargo invocation,
 *      OIDC flag selection, idempotency short-circuit, and the
 *      pre-publish secret-scan guard.
 *
 * Every test stubs both `globalThis.fetch` AND a `MockRunner` —
 * nothing touches the real network or real cargo.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import { __testing, CargoVersionActions } from "../../../src/release/core/version-actions/cargo";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";

const writeCargoToml = (dir: string, body: string): string => {
    const path = join(dir, "Cargo.toml");

    writeFileSync(path, body);

    return path;
};

interface RunCall {
    args: ReadonlyArray<string>;
    command: string;
    cwd: string;
}

const buildRunner = (responses: { exitCode?: number; stderr?: string; stdout?: string }[]): { calls: RunCall[]; runner: CommandRunner } => {
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

const ctx = (overridesInput?: {
    cargoTomlPath?: string;
    dir: string;
    dryRun?: boolean;
    newVersion?: string;
    registry?: string;
    runner?: CommandRunner;
    workspaceConfig?: Record<string, unknown>;
}): PublishContext => {
    const overrides = overridesInput ?? { dir: "" };

    return {
        catalogs: {} as never,
        dryRun: overrides.dryRun,
        perPackageConfig: {
            cargoTomlPath: overrides.cargoTomlPath,
        },
        pkg: {
            dir: overrides.dir,
            manifest: { name: "@scope/native", version: "1.0.0" },
            manifestPath: join(overrides.dir, "package.json"),
            name: "@scope/native",
            private: false,
            version: "1.0.0",
        },
        pm: {
            id: "npm" as const,
            minVersion: "8.0.0",
            runner: overrides.runner ?? buildRunner([]).runner,
        } as never,
        registry: overrides.registry,
        release: {
            changeFiles: [],
            isCascadeBump: false,
            isDependencyBump: false,
            isGroupBump: false,
            name: "@scope/native",
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
    workspace = mkdtempSync(join(tmpdir(), "vis-cargo-test-"));
    originalFetch = globalThis.fetch;
    originalEnv = { ...process.env };
    // Wipe ambient auth so tests don't depend on the dev machine's env.
    delete process.env["CARGO_REGISTRY_TOKEN"];
    delete process.env["ACTIONS_ID_TOKEN_REQUEST_URL"];
    delete process.env["ACTIONS_ID_TOKEN_REQUEST_TOKEN"];
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
});

describe("cargoVersionActions: identity", () => {
    it("has stable id `cargo`", () => {
        expect(new CargoVersionActions().id).toBe("cargo");
    });
});

describe("cargoVersionActions: readPublishedVersion", () => {
    it("returns crates.io max_stable_version on a 200 happy path", async () => {
        writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "1.0.0"\n`);
        stubFetch({ body: { crate: { max_stable_version: "1.2.3", max_version: "2.0.0-beta.1" } } });

        const actions = new CargoVersionActions();
        const result = await actions.readPublishedVersion({
            pkg: { dir: workspace, name: "@scope/native" } as never,
            pm: { runner: buildRunner([]).runner } as never,
        });

        expect(result).toBe("1.2.3");
    });

    it("falls back to max_version when max_stable_version is absent", async () => {
        writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "0.1.0"\n`);
        stubFetch({ body: { crate: { max_version: "0.5.0" } } });

        const result = await new CargoVersionActions().readPublishedVersion({
            pkg: { dir: workspace, name: "@scope/native" } as never,
            pm: { runner: buildRunner([]).runner } as never,
        });

        expect(result).toBe("0.5.0");
    });

    it("returns undefined on 404 (crate doesn't exist yet)", async () => {
        writeCargoToml(workspace, `[package]\nname = "fresh-crate"\nversion = "0.1.0"\n`);
        stubFetch({ ok: false, status: 404 });

        const result = await new CargoVersionActions().readPublishedVersion({
            pkg: { dir: workspace, name: "@scope/native" } as never,
            pm: { runner: buildRunner([]).runner } as never,
        });

        expect(result).toBeUndefined();
    });

    it("returns undefined when fetch throws (network unreachable)", async () => {
        writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "1.0.0"\n`);
        stubFetch({ throws: true });

        const result = await new CargoVersionActions().readPublishedVersion({
            pkg: { dir: workspace, name: "@scope/native" } as never,
            pm: { runner: buildRunner([]).runner } as never,
        });

        expect(result).toBeUndefined();
    });

    it("returns undefined when Cargo.toml cannot be read (preserves publish-anyway path)", async () => {
        // No Cargo.toml at the workspace.
        stubFetch({ body: { crate: { max_version: "1.2.3" } } });

        const result = await new CargoVersionActions().readPublishedVersion({
            pkg: { dir: workspace, name: "@scope/native" } as never,
            pm: { runner: buildRunner([]).runner } as never,
        });

        expect(result).toBeUndefined();
    });
});

describe("cargoVersionActions: readCargoToml (parse helper)", () => {
    it("parses [package].version directly", async () => {
        const path = writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "2.5.1"\n`);
        const result = await __testing.readCargoToml(path);

        expect(result).toEqual({ name: "my-crate", version: "2.5.1" });
    });

    it("resolves version.workspace = true via [workspace.package]", async () => {
        const path = writeCargoToml(
            workspace,
            `[package]\nname = "member"\nversion.workspace = true\n\n[workspace.package]\nversion = "3.0.0"\n`,
        );

        const result = await __testing.readCargoToml(path);

        expect(result).toEqual({ name: "member", version: "3.0.0" });
    });

    it("throws CONFIG_INVALID when [package] is absent (workspace root pointed at directly)", async () => {
        const path = writeCargoToml(workspace, `[workspace]\nmembers = ["crate-a", "crate-b"]\n`);

        await expect(__testing.readCargoToml(path)).rejects.toMatchObject({
            code: "CONFIG_INVALID",
            file: path,
        });
    });

    it("throws CONFIG_INVALID when [package].version is missing", async () => {
        const path = writeCargoToml(workspace, `[package]\nname = "my-crate"\n`);

        await expect(__testing.readCargoToml(path)).rejects.toMatchObject({
            code: "CONFIG_INVALID",
        });
    });

    it("throws CONFIG_INVALID when the file is missing entirely", async () => {
        await expect(__testing.readCargoToml(join(workspace, "no-such-file.toml"))).rejects.toMatchObject({
            code: "CONFIG_INVALID",
        });
    });
});

describe("cargoVersionActions: shouldUseTrustedPublishing (M-3)", () => {
    it("returns true with OIDC env + no static token", () => {
        expect(__testing.shouldUseTrustedPublishing({
            ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.com",
        })).toBe(true);
    });

    it("returns true even when CARGO_REGISTRY_TOKEN is set (OIDC wins by default)", () => {
        // M-3: OIDC precedence aligned with python.ts. A leftover
        // static token in the env shouldn't silently downgrade the
        // operator's choice when the OIDC env signal is present.
        expect(__testing.shouldUseTrustedPublishing({
            ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.com",
            CARGO_REGISTRY_TOKEN: "cio_abc123",
        })).toBe(true);
    });

    it("returns false when preferStaticToken: true AND a static token is set (escape hatch)", () => {
        // M-3 escape hatch: explicit operator opt-in flips the
        // precedence so static wins even with OIDC env present.
        expect(__testing.shouldUseTrustedPublishing(
            {
                ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.com",
                CARGO_REGISTRY_TOKEN: "cio_abc123",
            },
            { publish: { preferStaticToken: true } },
        )).toBe(false);
    });

    it("returns true with preferStaticToken: true but no static token (degenerate — falls back to OIDC)", () => {
        // Escape hatch only matters when both signals are present.
        expect(__testing.shouldUseTrustedPublishing(
            { ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.com" },
            { publish: { preferStaticToken: true } },
        )).toBe(true);
    });

    it("returns false without OIDC env (developer machine, no token)", () => {
        expect(__testing.shouldUseTrustedPublishing({})).toBe(false);
    });
});

describe("cargoVersionActions: publish — dryRun", () => {
    it("returns published: true without invoking cargo or fetch", async () => {
        writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "1.0.1"\n`);
        const { calls, runner } = buildRunner([]);
        const fetchSpy = stubFetch({ body: {} });

        const result = await new CargoVersionActions().publish(ctx({
            dir: workspace,
            dryRun: true,
            runner,
        }));

        expect(result.published).toBe(true);
        expect(result.output).toContain("[dry-run / cargo]");
        expect(calls).toHaveLength(0);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe("cargoVersionActions: publish — happy path", () => {
    it("invokes `cargo publish --allow-dirty` when crates.io has an older version", async () => {
        writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "1.0.1"\n`);
        process.env["CARGO_REGISTRY_TOKEN"] = "cio_dummy_static_token";
        stubFetch({ body: { crate: { max_version: "1.0.0" } } });

        const { calls, runner } = buildRunner([{ exitCode: 0, stdout: "uploaded" }]);
        const result = await new CargoVersionActions().publish(ctx({
            dir: workspace,
            runner,
        }));

        expect(result.published).toBe(true);
        expect(result.alreadyPublished).not.toBe(true);
        expect(calls).toHaveLength(1);
        expect(calls[0]!.command).toBe("cargo");
        expect(calls[0]!.args).toEqual(["publish", "--allow-dirty"]);
    });

    it("never passes --trusted-publishing (M-7: not a real cargo flag)", async () => {
        // M-7 regression guard: cargo's trusted-publishing config is
        // in `Cargo.toml` / `~/.cargo/config.toml` — there is NO
        // `cargo publish --trusted-publishing` flag (as of cargo
        // 1.85 / late 2025). vis must let cargo's own auth resolution
        // pick up OIDC without adding a bogus CLI arg.
        writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "1.0.1"\n`);
        process.env["ACTIONS_ID_TOKEN_REQUEST_URL"] = "https://token.actions.githubusercontent.com";
        process.env["ACTIONS_ID_TOKEN_REQUEST_TOKEN"] = "ghs_dummy";
        // CARGO_REGISTRY_TOKEN deliberately absent — OIDC path.

        stubFetch({ body: { crate: { max_version: "1.0.0" } } });

        const { calls, runner } = buildRunner([{ exitCode: 0 }]);
        const result = await new CargoVersionActions().publish(ctx({
            dir: workspace,
            runner,
        }));

        expect(result.published).toBe(true);
        expect(result.output).toContain("trusted publishing");
        expect(calls[0]!.args).toEqual(["publish", "--allow-dirty"]);
        // Explicitly assert the bogus flag is gone.
        expect(calls[0]!.args).not.toContain("--trusted-publishing");
    });

    it("prefers OIDC when BOTH OIDC env AND a static token are set (M-3)", async () => {
        // M-3 alignment with python.ts: OIDC wins by default. A
        // leftover CARGO_REGISTRY_TOKEN in the env shouldn't silently
        // downgrade an operator who configured trusted publishing.
        writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "1.0.1"\n`);
        process.env["ACTIONS_ID_TOKEN_REQUEST_URL"] = "https://token.actions.githubusercontent.com";
        process.env["CARGO_REGISTRY_TOKEN"] = "cio_stale_token_from_last_year";

        stubFetch({ body: { crate: { max_version: "1.0.0" } } });

        const { runner } = buildRunner([{ exitCode: 0 }]);
        const result = await new CargoVersionActions().publish(ctx({
            dir: workspace,
            runner,
        }));

        expect(result.published).toBe(true);
        // Output flags the OIDC path so operators can see in CI logs
        // which auth mode was actually used.
        expect(result.output).toContain("trusted publishing");
    });

    it("preferStaticToken: true flips precedence — static wins when both signals are present (M-3 escape hatch)", async () => {
        writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "1.0.1"\n`);
        process.env["ACTIONS_ID_TOKEN_REQUEST_URL"] = "https://token.actions.githubusercontent.com";
        process.env["CARGO_REGISTRY_TOKEN"] = "cio_token_operator_chose";

        stubFetch({ body: { crate: { max_version: "1.0.0" } } });

        const { runner } = buildRunner([{ exitCode: 0 }]);
        const result = await new CargoVersionActions().publish(ctx({
            dir: workspace,
            runner,
            workspaceConfig: { publish: { preferStaticToken: true } },
        }));

        expect(result.published).toBe(true);
        // No "trusted publishing" suffix — we're on the static path.
        expect(result.output).not.toContain("trusted publishing");
    });
});

describe("cargoVersionActions: publish — idempotency", () => {
    it("short-circuits with alreadyPublished when crates.io max_version === new version", async () => {
        writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "1.0.1"\n`);
        process.env["CARGO_REGISTRY_TOKEN"] = "cio_dummy";
        stubFetch({ body: { crate: { max_version: "1.0.1" } } });

        const { calls, runner } = buildRunner([]);
        const result = await new CargoVersionActions().publish(ctx({
            dir: workspace,
            runner,
        }));

        expect(result.alreadyPublished).toBe(true);
        expect(result.published).toBe(false);
        expect(result.output).toContain("already on crates.io");
        // No cargo invocation — short-circuit before publish.
        expect(calls).toHaveLength(0);
    });
});

describe("cargoVersionActions: publish — failure modes", () => {
    it("throws AUTH_MISSING when neither CARGO_REGISTRY_TOKEN nor OIDC is available", async () => {
        writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "1.0.1"\n`);
        // No env set in beforeEach.
        stubFetch({ body: { crate: { max_version: "1.0.0" } } });

        await expect(new CargoVersionActions().publish(ctx({
            dir: workspace,
            runner: buildRunner([]).runner,
        }))).rejects.toMatchObject({ code: "AUTH_MISSING" });
    });

    it("throws PUBLISH_FAILED when cargo publish exits non-zero", async () => {
        writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "1.0.1"\n`);
        process.env["CARGO_REGISTRY_TOKEN"] = "cio_dummy";
        stubFetch({ body: { crate: { max_version: "1.0.0" } } });

        const { runner } = buildRunner([{ exitCode: 101, stderr: "error: 401 Unauthorized" }]);

        await expect(new CargoVersionActions().publish(ctx({
            dir: workspace,
            runner,
        }))).rejects.toMatchObject({ code: "PUBLISH_FAILED" });
    });

    it("throws CONFIG_INVALID when Cargo.toml version doesn't match planned release version", async () => {
        // Simulates the extra-files bump skipping a misconfigured file —
        // we publish 1.0.1 but disk says 1.0.0. Catching it pre-publish
        // saves a misleading "already published" or "not yet uploaded"
        // confusion downstream.
        writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "1.0.0"\n`);
        process.env["CARGO_REGISTRY_TOKEN"] = "cio_dummy";
        stubFetch({ body: { crate: { max_version: "0.9.0" } } });

        await expect(new CargoVersionActions().publish(ctx({
            dir: workspace,
            newVersion: "1.0.1",
            runner: buildRunner([]).runner,
        }))).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });
});

describe("cargoVersionActions: publish — pre-publish secret scan", () => {
    it("throws PUBLISH_FAILED when packSecretScan finds a leaked secret", async () => {
        // Layout: a .crate file that would carry an env file.
        writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "1.0.1"\n`);
        writeFileSync(join(workspace, "Cargo.lock"), "");
        writeFileSync(
            join(workspace, "leaked.env"),
            // A synthetic-but-realistic AWS key pair the secret-scanner flags.
            // NB: the canonical `AKIAIOSFODNN7EXAMPLE` doc key is deliberately
            // allowlisted by the scanner as a known false-positive, so it must
            // NOT be used here — pick a non-"EXAMPLE" access-key id.
            `AWS_ACCESS_KEY_ID=AKIA2E0A8F3B244C9986\nAWS_SECRET_ACCESS_KEY=wJalr7Utn3EMz9K7MDfNG2bPxR1iCYz4aKp9Lq8x\n`,
        );

        process.env["CARGO_REGISTRY_TOKEN"] = "cio_dummy";
        stubFetch({ body: { crate: { max_version: "1.0.0" } } });

        // `cargo package --list` is the first call; subsequent `cargo publish`
        // must NOT happen because the scanner aborts.
        const { calls, runner } = buildRunner([
            { exitCode: 0, stdout: "Cargo.toml\nCargo.lock\nleaked.env\n" }, // cargo package --list
        ]);

        await expect(new CargoVersionActions().publish(ctx({
            dir: workspace,
            runner,
            workspaceConfig: { publish: { guards: { packSecretScan: true } } },
        }))).rejects.toMatchObject({ code: "PUBLISH_FAILED" });

        // Only the file-list call ran — the actual publish was aborted.
        expect(calls).toHaveLength(1);
        expect(calls[0]!.args).toEqual(["package", "--list", "--allow-dirty"]);
    });
});

describe("cargoVersionActions: User-Agent header (B-3)", () => {
    it("stamps a vis-release User-Agent on crates.io metadata requests", async () => {
        // B-3: crates.io's policy asks for a contact UA. vis routes
        // all registry probes through `safeFetchVersionMetadata`,
        // which auto-injects the header.
        writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "1.0.0"\n`);

        const fetchSpy = stubFetch({ body: { crate: { max_version: "1.0.0" } } });

        await new CargoVersionActions().readPublishedVersion({
            pkg: { dir: workspace, name: "@scope/native" } as never,
            pm: { runner: buildRunner([]).runner } as never,
        });

        // First call to fetch — verify the headers carry a UA.
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        const callArgs = fetchSpy.mock.calls[0]!;
        const init = callArgs[1] as RequestInit | undefined;
        const headers = init?.headers as Record<string, string> | undefined;

        expect(headers).toBeDefined();
        expect(headers!["User-Agent"]).toMatch(/^vis-release\//);
        expect(headers!["User-Agent"]).toContain("github.com/visulima/visulima");
    });
});

describe("cargoVersionActions: publish — alternative registry", () => {
    it("passes --registry when context.registry is set to a non-crates.io URL", async () => {
        writeCargoToml(workspace, `[package]\nname = "my-crate"\nversion = "1.0.1"\n`);
        process.env["CARGO_REGISTRY_TOKEN"] = "cio_dummy";
        stubFetch({ body: { crate: { max_version: "1.0.0" } } });

        const { calls, runner } = buildRunner([{ exitCode: 0 }]);

        await new CargoVersionActions().publish(ctx({
            dir: workspace,
            registry: "internal",
            runner,
        }));

        expect(calls[0]!.args).toEqual(["publish", "--allow-dirty", "--registry", "internal"]);
    });
});
