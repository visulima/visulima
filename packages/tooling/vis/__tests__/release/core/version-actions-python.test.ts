/**
 * `PythonVersionActions` — first-class PyPI publishing.
 *
 * Test surface:
 *   - readPublishedVersion happy path + 404 + network failure
 *   - pyproject.toml parse (PEP 621 [project] version)
 *   - dynamic versioning rejection (CONFIG_INVALID)
 *   - Build backend detection (hatch / poetry / pdm / setuptools / uv)
 *   - Publish via twine (no uv on PATH)
 *   - Publish via uv (uv detected on PATH)
 *   - Trusted-publishing detection (OIDC env, no TWINE_PASSWORD)
 *   - Auth missing (no OIDC, no TWINE_PASSWORD) → AUTH_MISSING
 *   - Build failure → PUBLISH_FAILED
 *   - Already-published short-circuit
 *
 * No tests hit the real network or invoke real Python tooling. The
 * fetch surface is stubbed via `vi.spyOn(globalThis, "fetch")`, the
 * filesystem is driven through a real `mkdtempSync` so the pyproject
 * parser exercises actual TOML, and the runner is mocked via
 * `MockRunner`.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import { MockRunner } from "../../../src/release/core/shell-runner";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import {
    checkUvWorkspaceMembership,
    detectAuthMode,
    detectBackend,
    fetchPyPiVersion,
    PythonVersionActions,
    resolveBuildEnv,
    resolveUvLockPath,
} from "../../../src/release/core/version-actions/python";

// ── fixture helpers ─────────────────────────────────────────────────

const writePyProject = (dir: string, content: string): void => {
    writeFileSync(join(dir, "pyproject.toml"), content, "utf8");
};

interface CtxOverrides {
    cwd?: string;
    dryRun?: boolean;
    pkgName?: string;
    pythonProjectDir?: string;
    runner?: CommandRunner;
    version?: string;
}

const mkContext = (overrides: CtxOverrides = {}): PublishContext => {
    const cwd = overrides.cwd ?? "/cwd";

    return {
        catalogs: {} as never,
        dryRun: overrides.dryRun,
        perPackageConfig: {
            pythonProjectDir: overrides.pythonProjectDir,
        },
        pkg: {
            dir: cwd,
            manifest: { name: overrides.pkgName ?? "@scope/pkg", version: "1.0.0" },
            manifestPath: `${cwd}/package.json`,
            name: overrides.pkgName ?? "@scope/pkg",
            private: false,
            version: "1.0.0",
        } as never,
        pm: {
            id: "npm" as const,
            minVersion: "8.0.0",
            runner: overrides.runner ?? new MockRunner(),
        } as never,
        release: {
            changeFiles: [],
            isCascadeBump: false,
            isDependencyBump: false,
            isGroupBump: false,
            name: overrides.pkgName ?? "@scope/pkg",
            newVersion: overrides.version ?? "1.0.1",
            oldVersion: "1.0.0",
            reasons: ["EXPLICIT"],
            sources: [],
            type: "patch",
        },
        versionedManifestByName: new Map(),
        workspaceConfig: {},
    } as never;
};

// PyPI JSON-API stub. Returns a `Response`-shaped object.
const stubPypiResponse = (body: unknown, status = 200): Response => ({
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : status === 404 ? "Not Found" : "Error",
} as Response);

beforeEach(() => {
    // Clear PyPI auth env between tests so the detect-auth path is
    // deterministic — leaking from a previous test would silently
    // pass AUTH_MISSING assertions.
    delete process.env.TWINE_USERNAME;
    delete process.env.TWINE_PASSWORD;
    delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ── identity + dry-run ──────────────────────────────────────────────

describe("pythonVersionActions: identity", () => {
    it("has stable id `python`", () => {
        expect(new PythonVersionActions().id).toBe("python");
    });

    it("dry-run returns published: true without invoking anything", async () => {
        const runner = new MockRunner();
        let invoked = false;
        const wrapped: CommandRunner = {
            run: async (...args) => {
                invoked = true;

                return runner.run(...args);
            },
        };

        const actions = new PythonVersionActions();
        const result = await actions.publish(mkContext({ dryRun: true, runner: wrapped }));

        expect(result.published).toBe(true);
        expect(result.output).toContain("[dry-run / python]");
        expect(invoked).toBe(false);
    });
});

// ── readPublishedVersion (PyPI HTTP API) ───────────────────────────

describe("pythonVersionActions: readPublishedVersion", () => {
    it("parses .info.version from PyPI JSON on 200", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            stubPypiResponse({ info: { version: "2.3.4" } }),
        );

        const tmp = mkdtempSync(join(tmpdir(), "vis-py-"));

        writePyProject(tmp, `
[project]
name = "demo-pkg"
version = "1.0.0"
`);

        const actions = new PythonVersionActions();
        const result = await actions.readPublishedVersion({
            perPackageConfig: { pythonProjectDir: undefined },
            pkg: {
                dir: tmp,
                manifest: { name: "@scope/demo-pkg", version: "1.0.0" },
                manifestPath: `${tmp}/package.json`,
                name: "@scope/demo-pkg",
                private: false,
                version: "1.0.0",
            },
            pm: { id: "npm", minVersion: "8.0.0", runner: new MockRunner() } as never,
        });

        expect(result).toBe("2.3.4");

        const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;

        // Must lowercase + URL-encode the dist name from pyproject.toml.
        expect(calledUrl).toBe("https://pypi.org/pypi/demo-pkg/json");
    });

    it("returns undefined on 404 (package not on PyPI yet)", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(stubPypiResponse({}, 404));

        const result = await fetchPyPiVersion("brand-new-pkg");

        expect(result).toBeUndefined();
    });

    it("returns undefined on network failure", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

        const result = await fetchPyPiVersion("any-pkg");

        expect(result).toBeUndefined();
    });

    it("returns undefined on malformed JSON / missing info.version", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(stubPypiResponse({ /* no info */ }));

        const result = await fetchPyPiVersion("partial-pkg");

        expect(result).toBeUndefined();
    });
});

// ── dynamic-version refusal ─────────────────────────────────────────

describe("pythonVersionActions: dynamic versioning refusal", () => {
    it("throws CONFIG_INVALID when pyproject declares dynamic = [\"version\"]", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-py-dyn-"));

        writePyProject(tmp, `
[project]
name = "scm-pkg"
dynamic = ["version"]
`);

        // OIDC set so auth-missing isn't the failure path.
        process.env.ACTIONS_ID_TOKEN_REQUEST_URL = "https://token-url";

        vi.spyOn(globalThis, "fetch").mockResolvedValue(stubPypiResponse({}, 404));

        const actions = new PythonVersionActions();

        await expect(actions.publish(mkContext({ cwd: tmp }))).rejects.toMatchObject({
            code: "CONFIG_INVALID",
            hint: expect.stringContaining("Dynamic versioning"),
        });
    });
});

// ── build backend detection ────────────────────────────────────────

describe("pythonVersionActions: detectBackend", () => {
    it("detects hatchling.build → hatch", () => {
        expect(detectBackend({ "build-system": { "build-backend": "hatchling.build" } })).toBe("hatch");
    });

    it("detects poetry.core.masonry.api → poetry", () => {
        expect(detectBackend({ "build-system": { "build-backend": "poetry.core.masonry.api" } })).toBe("poetry");
    });

    it("detects pdm.backend → pdm", () => {
        expect(detectBackend({ "build-system": { "build-backend": "pdm.backend" } })).toBe("pdm");
    });

    it("detects setuptools.build_meta → setuptools", () => {
        expect(detectBackend({ "build-system": { "build-backend": "setuptools.build_meta" } })).toBe("setuptools");
    });

    it("detects uv_build → uv", () => {
        expect(detectBackend({ "build-system": { "build-backend": "uv_build" } })).toBe("uv");
    });

    it("returns 'unknown' for unrecognized / missing backend", () => {
        expect(detectBackend({ "build-system": { "build-backend": "weird.thing" } })).toBe("unknown");
        expect(detectBackend({ "build-system": {} })).toBe("unknown");
        expect(detectBackend(undefined)).toBe("unknown");
    });
});

// ── build-env resolution (which CLIs to invoke) ────────────────────

describe("pythonVersionActions: resolveBuildEnv", () => {
    it("prefers uv when backend is 'uv' regardless of PATH detection", () => {
        const env = resolveBuildEnv("uv", false);

        expect(env.buildCommand).toEqual({ args: ["build"], binary: "uv" });
        expect(env.publishCommand).toEqual({ args: ["publish"], binary: "uv" });
    });

    it("prefers uv when backend is 'unknown' AND uv is on PATH", () => {
        const env = resolveBuildEnv("unknown", true);

        expect(env.buildCommand.binary).toBe("uv");
        expect(env.publishCommand.binary).toBe("uv");
    });

    it("uses python -m build + twine upload for hatch", () => {
        const env = resolveBuildEnv("hatch", false);

        expect(env.buildCommand).toEqual({ args: ["-m", "build"], binary: "python" });
        expect(env.publishCommand).toEqual({ args: ["upload", "dist/*"], binary: "twine" });
    });

    it("uses python -m build for poetry / pdm / setuptools (PEP 517 universal)", () => {
        for (const backend of ["poetry", "pdm", "setuptools"] as const) {
            const env = resolveBuildEnv(backend, false);

            expect(env.buildCommand.binary).toBe("python");
            expect(env.buildCommand.args).toEqual(["-m", "build"]);
            expect(env.publishCommand.binary).toBe("twine");
        }
    });
});

// ── auth-mode detection ────────────────────────────────────────────

describe("pythonVersionActions: detectAuthMode (M-3)", () => {
    it("returns 'token' when only TWINE_PASSWORD is set", () => {
        expect(detectAuthMode({ TWINE_PASSWORD: "pypi-token" })).toBe("token");
    });

    it("returns 'oidc' when only ACTIONS_ID_TOKEN_REQUEST_URL is set", () => {
        expect(detectAuthMode({ ACTIONS_ID_TOKEN_REQUEST_URL: "https://x" })).toBe("oidc");
    });

    it("prefers 'oidc' over 'token' when both are present (M-3)", () => {
        // M-3 alignment: OIDC env signal means the operator wired up
        // trusted publishing; a leftover TWINE_PASSWORD shouldn't
        // silently downgrade. (Previous behaviour was the inverse —
        // that was the bug.)
        expect(detectAuthMode({
            ACTIONS_ID_TOKEN_REQUEST_URL: "https://x",
            TWINE_PASSWORD: "tok",
        })).toBe("oidc");
    });

    it("returns 'token' when preferStaticToken: true AND both signals are present (escape hatch)", () => {
        // M-3 escape hatch for operators migrating off OIDC or
        // running a shadow publish.
        expect(detectAuthMode(
            { ACTIONS_ID_TOKEN_REQUEST_URL: "https://x", TWINE_PASSWORD: "tok" },
            { publish: { preferStaticToken: true } },
        )).toBe("token");
    });

    it("returns 'oidc' when preferStaticToken: true but no static token is present", () => {
        // Escape hatch only fires when there's actually a static
        // token to fall back to.
        expect(detectAuthMode(
            { ACTIONS_ID_TOKEN_REQUEST_URL: "https://x" },
            { publish: { preferStaticToken: true } },
        )).toBe("oidc");
    });

    it("returns 'missing' when neither is set", () => {
        expect(detectAuthMode({})).toBe("missing");
    });
});

// ── end-to-end publish (mocked runner + fetch) ─────────────────────

describe("pythonVersionActions: publish via twine (no uv)", () => {
    it("invokes python -m build then twine upload dist/*", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-py-twine-"));

        writePyProject(tmp, `
[project]
name = "demo"
version = "1.0.1"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
`);

        process.env.TWINE_PASSWORD = "pypi-token";

        // PyPI JSON returns older version — proceed with publish.
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            stubPypiResponse({ info: { version: "1.0.0" } }),
        );

        const runner = new MockRunner();

        // uv probe → fail (not installed)
        runner.on("uv", ["--version"], () => { return { exitCode: 127, stderr: "uv: not found", stdout: "" }; });
        runner.on("python", ["-m", "build"], () => { return { exitCode: 0, stderr: "", stdout: "build ok" }; });
        runner.on("twine", ["upload", "dist/*"], () => { return { exitCode: 0, stderr: "", stdout: "upload ok" }; });

        const actions = new PythonVersionActions();
        const result = await actions.publish(mkContext({ cwd: tmp, runner, version: "1.0.1" }));

        expect(result.published).toBe(true);
        expect(result.output).toContain("[python/hatch]");
        expect(result.output).toContain("demo@1.0.1");
    });
});

describe("pythonVersionActions: publish via uv", () => {
    it("invokes uv build + uv publish when uv is on PATH", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-py-uv-"));

        writePyProject(tmp, `
[project]
name = "demo"
version = "1.0.1"
`);

        process.env.TWINE_PASSWORD = "pypi-token";

        vi.spyOn(globalThis, "fetch").mockResolvedValue(stubPypiResponse({}, 404));

        const calls: { args: ReadonlyArray<string>; command: string }[] = [];
        const runner: CommandRunner = {
            run: async (command, args) => {
                calls.push({ args, command });

                if (command === "uv" && args[0] === "--version") {
                    return { exitCode: 0, stderr: "", stdout: "uv 0.5.0" };
                }

                if (command === "uv" && args[0] === "build") {
                    return { exitCode: 0, stderr: "", stdout: "" };
                }

                if (command === "uv" && args[0] === "publish") {
                    return { exitCode: 0, stderr: "", stdout: "" };
                }

                return { exitCode: 1, stderr: "unexpected", stdout: "" };
            },
        };

        const actions = new PythonVersionActions();
        const result = await actions.publish(mkContext({ cwd: tmp, runner, version: "1.0.1" }));

        expect(result.published).toBe(true);
        expect(result.output).toContain("+uv");

        const cmdShape = calls.map((c) => `${c.command} ${c.args.join(" ")}`);

        expect(cmdShape).toContain("uv --version");
        expect(cmdShape).toContain("uv build");
        expect(cmdShape).toContain("uv publish");
        // twine MUST NOT have been invoked.
        expect(cmdShape.some((c) => c.startsWith("twine"))).toBe(false);
    });
});

// ── User-Agent stamping (B-3) ──────────────────────────────────────

describe("pythonVersionActions: PyPI User-Agent header (B-3)", () => {
    it("stamps a vis-release User-Agent on PyPI metadata requests", async () => {
        // PyPI explicitly asks for a contact UA; vis routes the
        // JSON-API probe through `safeFetchVersionMetadata`.
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            stubPypiResponse({ info: { version: "1.0.0" } }),
        );

        await fetchPyPiVersion("any-pkg");

        expect(fetchSpy).toHaveBeenCalled();

        const init = fetchSpy.mock.calls[0]![1];
        const headers = init?.headers as Record<string, string> | undefined;

        expect(headers).toBeDefined();
        expect(headers!["User-Agent"]).toMatch(/^vis-release\//);
        expect(headers!["User-Agent"]).toContain("github.com/visulima/visulima");
    });
});

// ── trusted-publishing detection ───────────────────────────────────

describe("pythonVersionActions: OIDC trusted publishing", () => {
    it("proceeds when ACTIONS_ID_TOKEN_REQUEST_URL is set even with no TWINE_PASSWORD", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-py-oidc-"));

        writePyProject(tmp, `
[project]
name = "demo"
version = "1.0.1"
`);

        process.env.ACTIONS_ID_TOKEN_REQUEST_URL = "https://token-url";

        vi.spyOn(globalThis, "fetch").mockResolvedValue(stubPypiResponse({}, 404));

        let twineRan = false;
        const runner: CommandRunner = {
            run: async (command, args, options) => {
                if (command === "uv") {
                    return { exitCode: 127, stderr: "", stdout: "" };
                }

                if (command === "python") {
                    return { exitCode: 0, stderr: "", stdout: "" };
                }

                if (command === "twine") {
                    twineRan = true;

                    // TWINE_USERNAME should NOT be injected when we're on
                    // the OIDC path — the env var is only for the static-
                    // token flow.
                    expect(options.env?.TWINE_USERNAME).toBeUndefined();

                    return { exitCode: 0, stderr: "", stdout: "" };
                }

                return { exitCode: 1, stderr: "", stdout: "" };
            },
        };

        const actions = new PythonVersionActions();
        const result = await actions.publish(mkContext({ cwd: tmp, runner, version: "1.0.1" }));

        expect(result.published).toBe(true);
        expect(twineRan).toBe(true);
    });

    it("injects TWINE_USERNAME=__token__ for the static-token flow when not already set", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-py-tok-"));

        writePyProject(tmp, `
[project]
name = "demo"
version = "1.0.1"
`);

        process.env.TWINE_PASSWORD = "pypi-token";

        vi.spyOn(globalThis, "fetch").mockResolvedValue(stubPypiResponse({}, 404));

        let observedUsername: string | undefined;
        const runner: CommandRunner = {
            run: async (command, args, options) => {
                if (command === "uv") {
                    return { exitCode: 127, stderr: "", stdout: "" };
                }

                if (command === "python") {
                    return { exitCode: 0, stderr: "", stdout: "" };
                }

                if (command === "twine") {
                    observedUsername = options.env?.TWINE_USERNAME;

                    return { exitCode: 0, stderr: "", stdout: "" };
                }

                return { exitCode: 1, stderr: "", stdout: "" };
            },
        };

        const actions = new PythonVersionActions();

        await actions.publish(mkContext({ cwd: tmp, runner, version: "1.0.1" }));

        expect(observedUsername).toBe("__token__");
    });
});

// ── M-3 end-to-end: OIDC vs token precedence in publish() ─────────

describe("pythonVersionActions: M-3 OIDC precedence in publish()", () => {
    it("uses OIDC (no TWINE_USERNAME injection) when both env vars are present", async () => {
        // M-3: OIDC wins by default even with TWINE_PASSWORD set.
        const tmp = mkdtempSync(join(tmpdir(), "vis-py-m3-oidc-"));

        writePyProject(tmp, `
[project]
name = "demo"
version = "1.0.1"
`);

        process.env.TWINE_PASSWORD = "stale-token-from-last-year";
        process.env.ACTIONS_ID_TOKEN_REQUEST_URL = "https://token-url";

        vi.spyOn(globalThis, "fetch").mockResolvedValue(stubPypiResponse({}, 404));

        let observedUsername: string | undefined;
        let twineRan = false;

        const runner: CommandRunner = {
            run: async (command, args, options) => {
                if (command === "uv") {
                    return { exitCode: 127, stderr: "", stdout: "" };
                }

                if (command === "python") {
                    return { exitCode: 0, stderr: "", stdout: "" };
                }

                if (command === "twine") {
                    twineRan = true;
                    observedUsername = options.env?.TWINE_USERNAME;

                    return { exitCode: 0, stderr: "", stdout: "" };
                }

                return { exitCode: 1, stderr: "", stdout: "" };
            },
        };

        await new PythonVersionActions().publish(mkContext({ cwd: tmp, runner, version: "1.0.1" }));

        expect(twineRan).toBe(true);
        // OIDC path: TWINE_USERNAME=__token__ is NOT injected (only
        // the static-token path needs it). The leftover TWINE_PASSWORD
        // is left in the env for the trusted-publishing helper to
        // ignore.
        expect(observedUsername).toBeUndefined();
    });

    it("preferStaticToken: true flips precedence — TWINE_USERNAME=__token__ is injected (M-3 escape hatch)", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-py-m3-escape-"));

        writePyProject(tmp, `
[project]
name = "demo"
version = "1.0.1"
`);

        process.env.TWINE_PASSWORD = "operator-chose-static";
        process.env.ACTIONS_ID_TOKEN_REQUEST_URL = "https://token-url";

        vi.spyOn(globalThis, "fetch").mockResolvedValue(stubPypiResponse({}, 404));

        let observedUsername: string | undefined;

        const runner: CommandRunner = {
            run: async (command, args, options) => {
                if (command === "uv") {
                    return { exitCode: 127, stderr: "", stdout: "" };
                }

                if (command === "python") {
                    return { exitCode: 0, stderr: "", stdout: "" };
                }

                if (command === "twine") {
                    observedUsername = options.env?.TWINE_USERNAME;

                    return { exitCode: 0, stderr: "", stdout: "" };
                }

                return { exitCode: 1, stderr: "", stdout: "" };
            },
        };

        const ctxWithEscape = mkContext({ cwd: tmp, runner, version: "1.0.1" });

        // Inject workspaceConfig with the escape hatch.
        (ctxWithEscape as { workspaceConfig: unknown }).workspaceConfig = {
            publish: { preferStaticToken: true },
        };

        await new PythonVersionActions().publish(ctxWithEscape);

        // Static-token path → __token__ injection.
        expect(observedUsername).toBe("__token__");
    });
});

// ── auth missing ───────────────────────────────────────────────────

describe("pythonVersionActions: AUTH_MISSING", () => {
    it("throws AUTH_MISSING when neither TWINE_PASSWORD nor OIDC env is set", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-py-noauth-"));

        writePyProject(tmp, `
[project]
name = "demo"
version = "1.0.1"
`);

        vi.spyOn(globalThis, "fetch").mockResolvedValue(stubPypiResponse({}, 404));

        const runner = new MockRunner();

        runner.on("uv", ["--version"], () => { return { exitCode: 127, stderr: "", stdout: "" }; });

        const actions = new PythonVersionActions();

        await expect(actions.publish(mkContext({ cwd: tmp, runner, version: "1.0.1" }))).rejects.toMatchObject({
            code: "AUTH_MISSING",
        });
    });
});

// ── build failure ─────────────────────────────────────────────────

describe("pythonVersionActions: build failure", () => {
    it("throws PUBLISH_FAILED when python -m build exits non-zero", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-py-buildfail-"));

        writePyProject(tmp, `
[project]
name = "demo"
version = "1.0.1"
`);

        process.env.TWINE_PASSWORD = "pypi-token";

        vi.spyOn(globalThis, "fetch").mockResolvedValue(stubPypiResponse({}, 404));

        const runner = new MockRunner();

        runner.on("uv", ["--version"], () => { return { exitCode: 127, stderr: "", stdout: "" }; });
        runner.on("python", ["-m", "build"], () => {
            return {
                exitCode: 1,
                stderr: "ImportError: build module missing",
                stdout: "",
            };
        });

        const actions = new PythonVersionActions();

        await expect(actions.publish(mkContext({ cwd: tmp, runner, version: "1.0.1" }))).rejects.toMatchObject({
            code: "PUBLISH_FAILED",
            message: expect.stringContaining("build failed"),
        });
    });
});

// ── already-published short-circuit ────────────────────────────────

describe("pythonVersionActions: already-published short-circuit", () => {
    it("returns alreadyPublished without invoking build/twine when PyPI reports the new version", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-py-already-"));

        writePyProject(tmp, `
[project]
name = "demo"
version = "1.0.1"
`);

        process.env.TWINE_PASSWORD = "pypi-token";

        // PyPI already has 1.0.1 — vis must skip.
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            stubPypiResponse({ info: { version: "1.0.1" } }),
        );

        const calls: string[] = [];
        const runner: CommandRunner = {
            run: async (command, args) => {
                calls.push(`${command} ${args.join(" ")}`);

                return { exitCode: 0, stderr: "", stdout: "" };
            },
        };

        const actions = new PythonVersionActions();
        const result = await actions.publish(mkContext({ cwd: tmp, runner, version: "1.0.1" }));

        expect(result.alreadyPublished).toBe(true);
        expect(result.published).toBe(false);
        // No build / publish invocation — only the (no) uv probe is
        // permitted (and we don't even reach that since the already-
        // published gate triggers before backend resolution).
        expect(calls.filter((c) => c.startsWith("python") || c.startsWith("twine") || c.startsWith("uv "))).toHaveLength(0);
    });
});

// ── version-mismatch guard ─────────────────────────────────────────

// ── uv lockfile + workspace (release-please #2560 / #2561) ─────────

describe("pythonVersionActions: resolveUvLockPath", () => {
    it("returns <pkg.dir>/uv.lock when no per-package override is set", () => {
        const result = resolveUvLockPath(
            { dir: "/repo/py/sdk", name: "@scope/sdk" } as never,
        );

        expect(result).toBe("/repo/py/sdk/uv.lock");
    });

    it("honours perPackageConfig.uvLockPath (relative to pkg.dir)", () => {
        // Operators point this at `../uv.lock` when uv manages the
        // lockfile at the workspace root rather than per-package.
        const result = resolveUvLockPath(
            { dir: "/repo/py/sdk", name: "@scope/sdk" } as never,
            { uvLockPath: "../uv.lock" },
        );

        expect(result).toBe("/repo/py/uv.lock");
    });
});

describe("pythonVersionActions: checkUvWorkspaceMembership", () => {
    it("returns 'no-root-pyproject' when the root has no pyproject.toml", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-uv-empty-"));

        const result = await checkUvWorkspaceMembership(tmp, "py/sdk");

        expect(result).toBe("no-root-pyproject");
    });

    it("returns 'no-workspace' when the root pyproject has no [tool.uv.workspace] block", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-uv-no-ws-"));

        writePyProject(tmp, `
[project]
name = "monorepo-root"
version = "0.0.0"
`);

        const result = await checkUvWorkspaceMembership(tmp, "py/sdk");

        expect(result).toBe("no-workspace");
    });

    it("returns 'member' when the relative path matches a literal members entry", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-uv-literal-"));

        writePyProject(tmp, `
[project]
name = "monorepo-root"
version = "0.0.0"

[tool.uv.workspace]
members = ["py/sdk", "py/cli"]
`);

        const result = await checkUvWorkspaceMembership(tmp, "py/sdk");

        expect(result).toBe("member");
    });

    it("returns 'member' for a glob entry (`py/*`)", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-uv-glob-"));

        writePyProject(tmp, `
[project]
name = "monorepo-root"
version = "0.0.0"

[tool.uv.workspace]
members = ["py/*"]
`);

        const result = await checkUvWorkspaceMembership(tmp, "py/sdk");

        expect(result).toBe("member");
    });

    it("returns 'member' for a recursive glob entry (`py/**`)", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-uv-recursive-"));

        writePyProject(tmp, `
[project]
name = "monorepo-root"
version = "0.0.0"

[tool.uv.workspace]
members = ["py/**"]
`);

        const result = await checkUvWorkspaceMembership(tmp, "py/sdk/nested");

        expect(result).toBe("member");
    });

    it("returns 'missing' when the path doesn't match any member entry", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-uv-missing-"));

        writePyProject(tmp, `
[project]
name = "monorepo-root"
version = "0.0.0"

[tool.uv.workspace]
members = ["py/sdk"]
`);

        const result = await checkUvWorkspaceMembership(tmp, "py/cli");

        expect(result).toBe("missing");
    });

    it("`py/*` does NOT match nested paths beyond a single segment", async () => {
        // Regression guard: a non-recursive glob shouldn't accept
        // arbitrarily-deep paths. Operators on a deep tree should
        // use `py/**` instead.
        const tmp = mkdtempSync(join(tmpdir(), "vis-uv-nonrecursive-"));

        writePyProject(tmp, `
[project]
name = "monorepo-root"
version = "0.0.0"

[tool.uv.workspace]
members = ["py/*"]
`);

        const result = await checkUvWorkspaceMembership(tmp, "py/sdk/sub");

        expect(result).toBe("missing");
    });
});

describe("pythonVersionActions: pyproject version drift", () => {
    it("throws BUMP_FILE_INVALID when the on-disk version differs from planned", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "vis-py-drift-"));

        // On-disk pyproject has 0.9.0 but plan says 1.0.1 — preset
        // didn't run / was misconfigured.
        writePyProject(tmp, `
[project]
name = "demo"
version = "0.9.0"
`);

        process.env.TWINE_PASSWORD = "pypi-token";

        vi.spyOn(globalThis, "fetch").mockResolvedValue(stubPypiResponse({}, 404));

        const actions = new PythonVersionActions();

        await expect(actions.publish(mkContext({ cwd: tmp, version: "1.0.1" }))).rejects.toMatchObject({
            code: "BUMP_FILE_INVALID",
        });
    });
});
