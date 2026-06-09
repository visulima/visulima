/**
 * `vis release doctor` — preflight diagnostics (RFC §19.2).
 *
 * Runs a series of read-only checks, each tagged `error|warn|info`.
 * Exits non-zero on any error. JSON mode emits a structured report
 * for CI consumption (the schema is part of the public API surface
 * per RFC §21.1 — additions are minor; removals are major).
 */

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import type { OrchestratorContext } from "../../../release/core/orchestrator";
import { buildContext } from "../../../release/core/orchestrator";
import type { ReleaseDoctorOptions } from "./index";

type Severity = "error" | "warn" | "info";

interface Check {
    message: string;
    name: string;
    severity: Severity;
    status: "pass" | "fail" | "skip";
}

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleaseDoctorOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const checks: Check[] = [];

    // Definite-assignment: the catch below always `return`s, so any code
    // past the try/catch only runs when `buildContext` succeeded.
    let ctx!: OrchestratorContext;

    try {
        ctx = await buildContext({ cwd });

        checks.push({
            message: "vis.config.ts loaded; release block parsed.",
            name: "config-loads",
            severity: "error",
            status: "pass",
        });
    } catch (error) {
        checks.push({
            message: `Config failed to load: ${(error as Error).message}`,
            name: "config-loads",
            severity: "error",
            status: "fail",
        });

        await emit(logger, options, checks);
        process.exitCode = 1;

        return;
    }

    // Workspace integrity
    if (ctx.packages.length === 0) {
        checks.push({
            message: "No packages discovered. Ensure your package manager's workspace block resolves.",
            name: "workspace-discovered",
            severity: "error",
            status: "fail",
        });
    } else {
        checks.push({
            message: `Discovered ${ctx.packages.length} workspace package(s).`,
            name: "workspace-discovered",
            severity: "info",
            status: "pass",
        });
    }

    // Package manager version
    try {
        const detectedVersion = await ctx.pm.detectVersion(cwd);

        if (detectedVersion) {
            checks.push({
                message: `${ctx.pm.id}@${detectedVersion} (min required: ${ctx.pm.minVersion})`,
                name: "pm-version",
                severity: "info",
                status: "pass",
            });
        } else {
            checks.push({
                message: `Could not detect ${ctx.pm.id} version.`,
                name: "pm-version",
                severity: "warn",
                status: "skip",
            });
        }
    } catch (error) {
        checks.push({
            message: `Skipped: ${(error as Error).message}`,
            name: "pm-version",
            severity: "warn",
            status: "skip",
        });
    }

    // Branch / channel resolution
    if (ctx.branch && ctx.channel) {
        checks.push({
            message: `Branch "${ctx.branch}" → channel ${ctx.channel.tag}${ctx.channel.prerelease ? ` (preid: ${ctx.channel.prerelease})` : ""}, mode: ${ctx.channel.mode}`,
            name: "branch-channel",
            severity: "info",
            status: "pass",
        });
    } else if (ctx.branch && !ctx.channel) {
        checks.push({
            message: `Branch "${ctx.branch}" does not match any configured channel. Releases will use dist-tag "latest" by default.`,
            name: "branch-channel",
            severity: "warn",
            status: "fail",
        });
    } else {
        checks.push({
            message: "No branch detected (detached HEAD or non-git workspace).",
            name: "branch-channel",
            severity: "warn",
            status: "skip",
        });
    }

    // gh CLI for GH releases / PR comments
    try {
        const ghCheck = await import("node:child_process").then(({ execSync }) => {
            try {
                execSync("gh --version", { stdio: "ignore" });

                return true;
            } catch {
                return false;
            }
        });

        if (ghCheck) {
            checks.push({
                message: "gh CLI is on PATH.",
                name: "gh-cli-available",
                severity: "info",
                status: "pass",
            });
        } else {
            checks.push({
                message: "gh CLI not found. GH releases / PR comments will be skipped.",
                name: "gh-cli-available",
                severity: "warn",
                status: "fail",
            });
        }
    } catch {
        // ignore
    }

    // github.token-scopes — semantic-release #2469 parity.
    //
    // Introspect the GH token's OAuth scopes via `gh auth status --show-token`
    // and warn when it carries broader scopes than vis needs for release flow.
    // vis only needs `contents:write` + `pull-requests:write` (+ optional
    // `id-token:write` for OIDC trusted publishing). Tokens with `repo`,
    // `admin:org`, `delete_repo`, or `workflow` cleared for unrelated reasons
    // are an unnecessary blast radius — a stolen token compromises more than
    // it should.
    //
    // Skips entirely when not in CI or when `gh auth status` returns no token —
    // this is an observability check, not a hard gate.
    const isCi = process.env["CI"] === "true" || process.env["GITHUB_ACTIONS"] === "true";

    if (isCi) {
        try {
            const { createShellRunner } = await import("../../../release/core/shell-runner");
            const runner = createShellRunner();
            const result = await runner.run("gh", ["auth", "status", "--show-token"], { cwd, silent: true });

            // gh emits "Token scopes: 'repo', 'workflow', …" — the colon-prefixed
            // line is stable across gh CLI 2.x and the source of truth used by
            // semantic-release-github too.
            const combined = `${result.stdout}\n${result.stderr}`;
            const scopesLine = /Token scopes:\s*(.+)/.exec(combined);

            if (result.exitCode !== 0 || !scopesLine) {
                // Not a hard error — the token may use fine-grained PAT scopes
                // which `gh auth status` describes differently, or the env may
                // not be authenticated at all (e.g. release ran via OIDC).
                checks.push({
                    message: "Skipped: `gh auth status` did not return a parseable Token scopes line. (Fine-grained tokens / OIDC-only auth fall in this bucket.)",
                    name: "github.token-scopes",
                    severity: "info",
                    status: "skip",
                });
            } else {
                const scopes = scopesLine[1]!
                    .split(",")
                    .map((s) => s.trim().replaceAll(/^['"]|['"]$/g, ""))
                    .filter(Boolean);

                // Broad scopes — anything in this list is more than the release
                // flow needs and should trip the warn finding.
                const overprivilegedScopes = new Set(["admin:org", "admin:repo_hook", "delete_repo", "repo", "site_admin"]);
                const offenders = scopes.filter((s) => overprivilegedScopes.has(s));

                if (offenders.length > 0) {
                    checks.push({
                        message: `Token carries broader scopes than vis needs: ${offenders.join(", ")}. The release flow needs only contents:write + pull-requests:write (+ optional id-token:write for OIDC). Consider provisioning a fine-grained PAT or scoping the workflow's permissions block.`,
                        name: "github.token-scopes",
                        severity: "warn",
                        status: "fail",
                    });
                } else {
                    checks.push({
                        message: `Token scopes look appropriately narrow: ${scopes.join(", ") || "(none)"}.`,
                        name: "github.token-scopes",
                        severity: "info",
                        status: "pass",
                    });
                }
            }
        } catch {
            checks.push({
                message: "Skipped: gh auth status could not be invoked.",
                name: "github.token-scopes",
                severity: "info",
                status: "skip",
            });
        }
    }

    // OIDC env vars in CI
    if (process.env["CI"] === "true" || process.env["GITHUB_ACTIONS"] === "true") {
        if (process.env["ACTIONS_ID_TOKEN_REQUEST_URL"]) {
            checks.push({
                message: "GitHub Actions OIDC env vars present.",
                name: "oidc-available",
                severity: "info",
                status: "pass",
            });
        } else if (process.env["NPM_TOKEN"]) {
            checks.push({
                message: "OIDC env vars missing; falling back to NPM_TOKEN. Add `permissions: { id-token: write }` to the workflow to enable trusted publishing.",
                name: "oidc-available",
                severity: "warn",
                status: "fail",
            });
        } else {
            checks.push({
                message: "Neither OIDC env vars nor NPM_TOKEN are set in CI. Publish will fail.",
                name: "oidc-available",
                severity: "error",
                status: "fail",
            });
        }
    }

    // NAPI parents — verify platform packages exist + version match (RFC §19.2)
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    for (const pkg of ctx.packages) {
        if (pkg.manifest.napi === undefined) {
            continue;
        }

        const npmDir = path.join(pkg.dir, "npm");

        try {
            const npmEntries = await fs.readdir(npmDir, { withFileTypes: true });
            const platforms = npmEntries.filter((e) => e.isDirectory());

            if (platforms.length === 0) {
                checks.push({
                    message: `${pkg.name} has a napi field but no npm/<platform>/ subdirs. Run pnpm exec napi artifacts before publishing.`,
                    name: `napi-${pkg.name}-platforms`,
                    severity: "warn",
                    status: "fail",
                });

                continue;
            }

            // Verify each platform manifest has the same version as the parent
            const mismatches: string[] = [];

            for (const platform of platforms) {
                const platformManifestPath = path.join(npmDir, platform.name, "package.json");

                try {
                    const platformManifest = JSON.parse(await fs.readFile(platformManifestPath, "utf8"));

                    if (platformManifest.version !== pkg.version) {
                        mismatches.push(`${platform.name} (${platformManifest.version} vs parent ${pkg.version})`);
                    }
                } catch {
                    mismatches.push(`${platform.name} (unreadable manifest)`);
                }
            }

            if (mismatches.length > 0) {
                checks.push({
                    message: `${pkg.name}: platform versions out of sync — ${mismatches.join(", ")}. They'll be re-synced on next publish.`,
                    name: `napi-${pkg.name}-versions`,
                    severity: "warn",
                    status: "fail",
                });
            } else {
                checks.push({
                    message: `${pkg.name}: ${platforms.length} platform package(s), all versions in sync.`,
                    name: `napi-${pkg.name}`,
                    severity: "info",
                    status: "pass",
                });
            }

            // Verify optionalDependencies references each platform
            const optDeps = pkg.manifest.optionalDependencies ?? {};
            const missingOptDeps: string[] = [];

            for (const platform of platforms) {
                try {
                    const platformManifest = JSON.parse(await fs.readFile(path.join(npmDir, platform.name, "package.json"), "utf8")) as { name: string };

                    if (!Object.hasOwn(optDeps, platformManifest.name)) {
                        missingOptDeps.push(platformManifest.name);
                    }
                } catch {
                    // already reported above
                }
            }

            if (missingOptDeps.length > 0) {
                checks.push({
                    message: `${pkg.name}: missing optionalDependencies entries for: ${missingOptDeps.join(", ")}. Consumers won't get the right binary.`,
                    name: `napi-${pkg.name}-optdeps`,
                    severity: "error",
                    status: "fail",
                });
            }
        } catch {
            checks.push({
                message: `${pkg.name}: could not read npm/ subdir.`,
                name: `napi-${pkg.name}-platforms`,
                severity: "warn",
                status: "skip",
            });
        }
    }

    // Plan readability
    if (ctx.plan.warnings.length > 0) {
        for (const w of ctx.plan.warnings) {
            checks.push({ message: w, name: "plan-warning", severity: "warn", status: "fail" });
        }
    } else {
        checks.push({
            message: ctx.plan.releases.length === 0 ? "No pending releases." : `Plan resolves ${ctx.plan.releases.length} release(s).`,
            name: "plan-readable",
            severity: "info",
            status: "pass",
        });
    }

    // publish.guards: confirm dependencies for enabled gates resolve.
    const guards = ctx.config.publish?.guards;

    if (guards?.packSecretScan) {
        try {
            await import("@visulima/secret-scanner");
            checks.push({
                message: "@visulima/secret-scanner resolves; pack-set secret scanning will run.",
                name: "publish-guards.packSecretScan",
                severity: "info",
                status: "pass",
            });
        } catch {
            checks.push({
                message: "publish.guards.packSecretScan is enabled but @visulima/secret-scanner is not installed. pnpm add -D @visulima/secret-scanner, or set the gate to false.",
                name: "publish-guards.packSecretScan",
                severity: "error",
                status: "fail",
            });
        }
    }

    if (guards?.audit && guards.audit !== "off") {
        checks.push({
            message: `Runtime npm audit gate active at "${guards.audit}" severity.`,
            name: "publish-guards.audit",
            severity: "info",
            status: "pass",
        });
    }

    // publish.releaseAssets: stamping/upload only works when an asset is
    // produced (npm + native-addon paths).
    const releaseAssets = ctx.config.publish?.releaseAssets;

    if (releaseAssets?.stampHashes || releaseAssets?.uploadTarball) {
        checks.push({
            message: `Release-asset attestation: stampHashes=${releaseAssets.stampHashes ?? false}, uploadTarball=${releaseAssets.uploadTarball ?? false}.`,
            name: "publish-releaseAssets",
            severity: "info",
            status: "pass",
        });
    }

    // publish.stage: npm CLI 11.15.0+ and npmjs.com registry required.
    if (ctx.config.publish?.stage) {
        // npm version
        try {
            const { execSync } = await import("node:child_process");
            const npmVersion = execSync("npm --version", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
            const [major = "0", minor = "0"] = npmVersion.split(".");
            const ok = Number.parseInt(major, 10) > 11
                || (Number.parseInt(major, 10) === 11 && Number.parseInt(minor, 10) >= 15);

            checks.push({
                message: ok
                    ? `npm ${npmVersion} supports \`npm stage publish\`.`
                    : `npm ${npmVersion} is too old for staged publishing. Upgrade to npm ≥ 11.15.0.`,
                name: "publish-stage.npm-version",
                severity: ok ? "info" : "error",
                status: ok ? "pass" : "fail",
            });
        } catch {
            checks.push({
                message: "publish.stage is enabled but npm is not on PATH.",
                name: "publish-stage.npm-version",
                severity: "error",
                status: "fail",
            });
        }

        // Registry must be npmjs.com — staging is npm Inc-specific.
        const registry = ctx.config.publish?.registry ?? "https://registry.npmjs.org/";
        const isNpmjs = /(?:^|:\/\/)registry\.npmjs\.(?:org|com)\//.test(registry);

        checks.push({
            message: isNpmjs
                ? "Registry is npmjs.com; staging is supported."
                : `publish.stage is enabled but registry "${registry}" is not npmjs.com. Staging is npm Inc-specific; the request will be rejected.`,
            name: "publish-stage.registry",
            severity: isNpmjs ? "info" : "warn",
            status: isNpmjs ? "pass" : "fail",
        });

        // Refuse OIDC + any restricted-access package up-front (RFC §13.6).
        // The post-decision disambiguation GET needs read auth that OIDC
        // tokens don't provide. Better to fail preflight than to lose a
        // 30-minute review wait to an inevitable error.
        const restrictedPkgs = ctx.packages.filter((pkg) => {
            const access = (pkg.manifest.publishConfig as { access?: string } | undefined)?.access;

            return access === "restricted";
        });

        const isOidc = Boolean(process.env["ACTIONS_ID_TOKEN_REQUEST_URL"]) && !process.env["NPM_TOKEN"];

        if (restrictedPkgs.length > 0 && isOidc) {
            checks.push({
                message: `${restrictedPkgs.length} package(s) have publishConfig.access: "restricted" and OIDC trusted publishing is active. Staging this combo is not supported in v1 (no static token for the post-decision read). Set NPM_TOKEN, or disable publish.stage for these packages.`,
                name: "publish-stage.oidc-restricted",
                severity: "error",
                status: "fail",
            });
        }
    }

    // publish-stage.pending: surface any pending stages from prior waves
    // so the operator sees they're blocking the next release. Runs even
    // when publish.stage is off — a stage left over from a flipped
    // config still needs draining.
    try {
        const { DEFAULT_CHANGES_DIR } = await import("../../../release/config");
        const { readStagedRegistry } = await import("../../../release/core/staged-registry");
        const registry = await readStagedRegistry(cwd, ctx.config.changesDir ?? DEFAULT_CHANGES_DIR);

        if (registry.pending.length > 0) {
            const summary = registry.pending
                .map((entry) => `${entry.name}@${entry.version} (${entry.reason})`)
                .join(", ");

            checks.push({
                message: `${registry.pending.length} pending stage(s) recorded in .vis/release/staged.json: ${summary}. Approve / reject before the next release: vis release stage approve --all`,
                name: "publish-stage.pending",
                severity: "warn",
                status: "fail",
            });
        }
    } catch {
        // Registry unreadable — surface as info; not worth blocking on
        // since the publish flow will refuse anyway if it's truly corrupt.
    }

    // v0 migration: prior implementations stored stage ids in
    // `.state.json#stagedIds`. The new persistent registry is
    // `.vis/release/staged.json`. Surface any leftover stagedIds so the
    // operator can drain them via npmjs.com / `vis release stage approve`
    // before they get silently lost on the next state-file rewrite.
    try {
        const { DEFAULT_CHANGES_DIR } = await import("../../../release/config");
        const { readFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const statePath = join(cwd, ctx.config.changesDir ?? DEFAULT_CHANGES_DIR, ".state.json");
        const raw = await readFile(statePath, "utf8");
        const parsed = JSON.parse(raw) as { stagedIds?: string[] };

        if (Array.isArray(parsed.stagedIds) && parsed.stagedIds.length > 0) {
            checks.push({
                message: `Found ${parsed.stagedIds.length} legacy stage id(s) in .state.json#stagedIds: ${parsed.stagedIds.join(", ")}. The new registry lives in .vis/release/staged.json. Approve / reject these via npmjs.com or \`vis release stage approve <id>\` to avoid losing them.`,
                name: "publish-stage.legacy-stagedIds",
                severity: "warn",
                status: "fail",
            });
        }
    } catch {
        // .state.json absent or unreadable — fine, that's the normal case.
    }

    // shell-actions preflight: any package with versionActions: "shell"
    // must (a) be permitted by the allowCustomCommands trust gate AND
    // (b) carry a publishCommand. Without both, the publish phase
    // would throw CONFIG_INVALID at runtime — surface it at doctor
    // time so the operator notices BEFORE the release.
    {
        const shellPackages = ctx.packages.filter((pkg) => {
            const perPkg = ctx.perPackageConfig.get(pkg.name);

            return perPkg?.versionActions === "shell";
        });

        for (const pkg of shellPackages) {
            const perPkg = ctx.perPackageConfig.get(pkg.name) ?? {};
            const allow = ctx.config.allowCustomCommands;
            const allowed = allow === true
                || (Array.isArray(allow) && allow.includes(pkg.name));
            const hasPublishCommand = perPkg.publishCommand !== undefined && perPkg.publishCommand !== "";

            if (!allowed) {
                checks.push({
                    message: `${pkg.name} uses versionActions: "shell" but release.allowCustomCommands does not permit it. Set allowCustomCommands: true or include "${pkg.name}" in the array.`,
                    name: `shell-actions.${pkg.name}.trust-gate`,
                    severity: "error",
                    status: "fail",
                });
            }

            if (!hasPublishCommand) {
                checks.push({
                    message: `${pkg.name} uses versionActions: "shell" but no publishCommand is configured. Set release.packages["${pkg.name}"].publishCommand.`,
                    name: `shell-actions.${pkg.name}.publish-command`,
                    severity: "error",
                    status: "fail",
                });
            } else if (allowed) {
                checks.push({
                    message: `${pkg.name} → shell publish (${Array.isArray(perPkg.publishCommand) ? `${perPkg.publishCommand.length} commands` : "1 command"}).`,
                    name: `shell-actions.${pkg.name}`,
                    severity: "info",
                    status: "pass",
                });
            }
        }
    }

    // git.identity: vis auto-commits staged.json (and the version bump
    // when --commit is used). Both need a git author. config.gitUser is
    // the explicit override; otherwise we depend on `git config
    // user.name/email`. Surface a warn-level check when none of these
    // are set so the operator notices BEFORE the commit step fails.
    if (!ctx.config.gitUser) {
        try {
            const { createShellRunner } = await import("../../../release/core/shell-runner");
            const runner = createShellRunner();
            const nameResult = await runner.run("git", ["config", "user.name"], { cwd, silent: true });
            const emailResult = await runner.run("git", ["config", "user.email"], { cwd, silent: true });
            const hasName = nameResult.exitCode === 0 && nameResult.stdout.trim().length > 0;
            const hasEmail = emailResult.exitCode === 0 && emailResult.stdout.trim().length > 0;

            if (!hasName || !hasEmail) {
                checks.push({
                    message: `git config user.name/user.email is not set (name=${hasName ? "ok" : "missing"}, email=${hasEmail ? "ok" : "missing"}). vis auto-commits staged.json and version bumps — these will fail without an identity. Set release.gitUser in vis.config.ts or configure git globally.`,
                    name: "git.identity",
                    severity: "warn",
                    status: "fail",
                });
            } else {
                checks.push({
                    message: `git identity: ${nameResult.stdout.trim()} <${emailResult.stdout.trim()}>.`,
                    name: "git.identity",
                    severity: "info",
                    status: "pass",
                });
            }
        } catch {
            // git not available — surfaces elsewhere; don't double-warn.
        }
    }

    // git.signing: verify that the operator's git config carries the
    // right knobs for the configured signing mode. Surfaces missing
    // config as warn-level at preflight so the publish wave doesn't
    // crash mid-tag with an opaque GPG error.
    if (ctx.config.signing) {
        const { signing } = ctx.config;

        try {
            const { createShellRunner } = await import("../../../release/core/shell-runner");
            const runner = createShellRunner();
            const signingKeyResult = await runner.run("git", ["config", "user.signingkey"], { cwd, silent: true });
            const gpgFormatResult = await runner.run("git", ["config", "gpg.format"], { cwd, silent: true });
            const signingKey = signingKeyResult.exitCode === 0 ? signingKeyResult.stdout.trim() : "";
            const gpgFormat = gpgFormatResult.exitCode === 0 ? gpgFormatResult.stdout.trim() : "";
            const hasSigningKey = signingKey.length > 0 || Boolean(signing.key);

            if (signing.mode === "ssh") {
                if (gpgFormat !== "ssh" || !hasSigningKey) {
                    checks.push({
                        message: `release.signing.mode is "ssh" but git config is incomplete (gpg.format=${gpgFormat || "<unset>"}, user.signingkey=${hasSigningKey ? "ok" : "missing"}). Run \`git config gpg.format ssh\` and \`git config user.signingkey <path-to-key>\` before releasing.`,
                        name: "git.signing",
                        severity: "warn",
                        status: "fail",
                    });
                } else {
                    checks.push({
                        message: `git signing: ssh mode active (gpg.format=ssh, signingkey configured).`,
                        name: "git.signing",
                        severity: "info",
                        status: "pass",
                    });
                }
            } else if (signing.mode === "sigstore") {
                // Sigstore needs `gitsign` on PATH; otherwise we fall
                // back to GPG with a runtime warning. F15: reuse the
                // cached probe from git.ts so the doctor's signal matches
                // exactly what `createTag` will observe at publish time
                // — no risk of one path warning while the other passes.
                const { gitsignAvailable } = await import("../../../release/core/git");
                const gitsignFound = await gitsignAvailable({ cwd, runner });

                if (gitsignFound) {
                    checks.push({
                        message: `git signing: sigstore mode (preview); gitsign is on PATH.`,
                        name: "git.signing",
                        severity: "info",
                        status: "pass",
                    });
                } else {
                    checks.push({
                        message: `release.signing.mode is "sigstore" (preview) but gitsign is not on PATH. Tags will fall back to GPG signing with a warning. Install gitsign: https://github.com/sigstore/gitsign`,
                        name: "git.signing",
                        severity: "warn",
                        status: "fail",
                    });
                }
            } else if (hasSigningKey) {
                // Avoid emitting the full `signing.key` value: when it's a
                // filesystem path to a private key (common for ssh keys, or
                // `gpg --homedir`-style setups), the raw path would land in
                // CI logs alongside this success message. We surface "configured"
                // only — the redacted-tail (`…XXXX`) is shown for non-path
                // key ids of sufficient length, where the last 4 chars are
                // still useful for operators to confirm which key the daemon
                // picked but aren't sensitive.
                //
                // Classify-as-path catches both slash-bearing paths AND
                // cwd-local key files (e.g. `release.pem`) by extension —
                // otherwise the last-4 branch would leak the extension
                // (`…e.pem`). Short ids (<8 chars) also bypass the last-4
                // path because last-4 of a 5-char id leaks 80% of the secret.
                const keyHint = signing.key
                    ? /[\\/]/.test(signing.key)
                    || /\.(?:pem|gpg|key|asc|p12|pfx)$/i.test(signing.key)
                    || signing.key.length < 8
                        ? "configured"
                        : `…${signing.key.slice(-4)}`
                    : "from git config";

                checks.push({
                    message: `git signing: gpg mode active (key: ${keyHint}).`,
                    name: "git.signing",
                    severity: "info",
                    status: "pass",
                });
            } else {
                // signing.mode === "gpg"
                checks.push({
                    message: `release.signing.mode is "gpg" but neither release.signing.key nor git config user.signingkey is set. Configure one before releasing.`,
                    name: "git.signing",
                    severity: "warn",
                    status: "fail",
                });
            }
        } catch (error) {
            checks.push({
                message: `Could not verify git signing config: ${(error as Error).message}.`,
                name: "git.signing",
                severity: "warn",
                status: "skip",
            });
        }
    }

    // F24: floatingMajorTag + sigstore signing interaction.
    //
    // `floatingMajorTag: true` force-retargets `v<major>` on every
    // non-prerelease (semantic-release #1515 parity). When paired with
    // `signing.mode === "sigstore"` (Rekor-backed keyless signing), each
    // retarget produces a NEW sigstore transparency-log entry — Rekor
    // never deletes the prior entries. Operators get a slow accretion
    // of log entries proportional to release cadence × major lifetime.
    //
    // This is not a bug per se (Rekor's append-only model is intentional
    // — every signature is auditable), but it's a non-obvious cost that
    // surprises operators who turn both flags on. Warn so they can
    // make an informed choice: keep both, or drop one.
    if (ctx.config.floatingMajorTag === true && ctx.config.signing?.mode === "sigstore") {
        checks.push({
            message:
                "release.floatingMajorTag and release.signing.mode=\"sigstore\" are both enabled. "
                + "The floating-tag retarget force-pushes <unscoped-name>-v<major> (e.g. acme-action-v1) on every release, "
                + "which appends a new sigstore transparency-log entry to Rekor each time (Rekor is append-only — entries "
                + "are never removed). Over a long-lived major you'll accumulate one log entry per release. Consider either "
                + "dropping floatingMajorTag (and pin consumers to a specific tag) or switching to gpg/ssh signing "
                + "if the Rekor footprint matters for your project.",
            name: "floating-major-tag.signing-risk",
            severity: "warn",
            status: "fail",
        });
    }

    // Wave-7: floating-major-tag.legacy-tags — detect legacy `v<major>` tags.
    //
    // Earlier waves changed the floating-tag format from `v<major>` (e.g.
    // `v1`) to `<safe-name>-v<major>` (e.g. `acme-action-v1`). Operators who
    // previously published with the old format have downstream consumers
    // pinning `acme/action@v1`. After upgrading vis, the new tag is
    // `acme-action-v1` and bare `v1` is never updated — consumers silently
    // freeze at the pre-upgrade SHA. Surface the legacy tags so the
    // operator can either re-tag them at the new floating tag or sunset
    // them with a heads-up to downstream consumers.
    //
    // Skipped entirely when floatingMajorTag is off — operators who don't
    // use the feature shouldn't be pestered.
    if (ctx.config.floatingMajorTag === true) {
        try {
            const { createShellRunner } = await import("../../../release/core/shell-runner");
            const runner = createShellRunner();
            const listResult = await runner.run("git", ["tag", "--list", "v*"], { cwd, silent: true });

            if (listResult.exitCode === 0) {
                // Pure `v<digits>` only — `v1.0.0` (versioned) and
                // `pkg-v1` (new format) must not trip the check.
                const legacyTags = listResult.stdout
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => /^v\d+$/.test(line));

                if (legacyTags.length === 0) {
                    checks.push({
                        message: "No legacy `v<major>` tags found; floating-tag migration is clean.",
                        name: "floating-major-tag.legacy-tags",
                        severity: "info",
                        status: "pass",
                    });
                } else {
                    const shown = legacyTags.slice(0, 5);
                    const overflow = legacyTags.length > 5 ? ` (+${legacyTags.length - 5} more)` : "";
                    const sample = legacyTags[0]!;
                    const sampleMajor = sample.slice(1); // strip leading "v"

                    checks.push({
                        message:
                            `Legacy floating-major tags detected (${shown.join(", ")}${overflow}). `
                            + "After upgrading the floating-tag format to `<safe-name>-v<major>`, these legacy tags are no "
                            + `longer updated. Consumers pinning \`<repo>@${sample}\` will silently freeze at the `
                            + "pre-upgrade commit. Migration:\n"
                            + "  1. Re-tag the legacy tag to point at the new floating tag:\n"
                            + `       git tag -f ${sample} <safe-name>-v${sampleMajor}\n`
                            + `       git push --force origin ${sample}\n`
                            + "  2. Or sunset the legacy tag and announce the new pin to consumers.",
                        name: "floating-major-tag.legacy-tags",
                        severity: "warn",
                        status: "fail",
                    });
                }
            } else {
                checks.push({
                    message: `Skipped: \`git tag --list "v*"\` exited ${listResult.exitCode}.`,
                    name: "floating-major-tag.legacy-tags",
                    severity: "info",
                    status: "skip",
                });
            }
        } catch (error) {
            checks.push({
                message: `Skipped: could not list git tags: ${(error as Error).message}.`,
                name: "floating-major-tag.legacy-tags",
                severity: "info",
                status: "skip",
            });
        }
    }

    // M-1: --first-release sanity check.
    //
    // `--first-release` is the bootstrap-mode flag for greenfield
    // monorepos: vis skips registry / git-tag lookups and treats every
    // package's on-disk version as authoritative. If the workspace
    // ISN'T greenfield (it already has release tags, or a package is
    // live on its registry), running with `--first-release` would
    // double-bump or overwrite — both data-loss bugs.
    //
    // The check fires only when `--first-release` is set; otherwise
    // it's skipped (status: "skip"). Hard-error severity so the doctor
    // exits non-zero when triggered.
    if (options.firstRelease === true) {
        const greenFindings: string[] = [];

        // 1. Look for any git tag matching a configured releaseTagPattern.
        //    We check the workspace-level pattern AND each per-package
        //    override; even one matching tag means this isn't greenfield.
        try {
            const { createShellRunner } = await import("../../../release/core/shell-runner");
            const runner = createShellRunner();
            // Build the set of distinct glob patterns to test.
            const seen = new Set<string>();
            const rootPattern = ctx.config.releaseTagPattern ?? "{name}@{version}";

            seen.add(rootPattern);

            for (const pkg of ctx.packages) {
                const perPkg = ctx.perPackageConfig.get(pkg.name);
                const pattern = perPkg?.releaseTagPattern ?? rootPattern;

                seen.add(pattern);
            }

            // Translate each pattern into a `git tag --list` glob —
            // tokens that we can't resolve at preflight expand to `*`.
            for (const pattern of seen) {
                const glob = pattern.replaceAll(
                    /\{(?:name|unscopedName|version|major|minor|patch|date|channel)\}/g,
                    () => "*",
                );

                const listResult = await runner.run("git", ["tag", "--list", glob], { cwd, silent: true });

                if (listResult.exitCode !== 0) {
                    continue;
                }

                const tags = listResult.stdout
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean);

                if (tags.length > 0) {
                    greenFindings.push(`Found ${tags.length} git tag(s) matching "${pattern}": ${tags.slice(0, 5).join(", ")}${tags.length > 5 ? ` (+${tags.length - 5} more)` : ""}.`);
                    // One pattern with hits is enough — keep walking
                    // to surface every pattern that's been used in the
                    // repo, but cap output.
                }
            }
        } catch (error) {
            // git unavailable or some other infra issue — surface as a
            // skip, not a pass. The other publish-side gates will
            // surface git problems separately.
            greenFindings.push(`Could not scan git tags: ${(error as Error).message}.`);
        }

        // 2. Look for any package whose registry / on-disk version
        //    indicates it's already published. We route through each
        //    package's own versionActions so cargo/python/maven/etc.
        //    contribute, NOT just npm.
        //
        //    The factory is inlined to avoid a circular import (orchestrator
        //    owns the canonical dispatch; importing it from the doctor
        //    pulls a heavy graph in here too).
        try {
            const { resolveVersionActionsId } = await import("../../../release/core/workspace");
            const { CargoVersionActions } = await import("../../../release/core/version-actions/cargo");
            const { ContainerActions } = await import("../../../release/core/version-actions/container");
            const { MavenVersionActions } = await import("../../../release/core/version-actions/maven");
            const { NativeAddonVersionActions } = await import("../../../release/core/version-actions/native-addon");
            const { NpmVersionActions } = await import("../../../release/core/version-actions/npm");
            const { PrivateVersionActions } = await import("../../../release/core/version-actions/private");
            const { PythonVersionActions } = await import("../../../release/core/version-actions/python");
            const { ShellPublishActions } = await import("../../../release/core/version-actions/shell");

            const factory = (id: string) => {
                switch (id) {
                    case "cargo": { return new CargoVersionActions();
                    }
                    case "container": { return new ContainerActions();
                    }
                    case "maven": { return new MavenVersionActions();
                    }
                    case "native-addon": { return new NativeAddonVersionActions();
                    }
                    case "private": { return new PrivateVersionActions();
                    }
                    case "python": { return new PythonVersionActions();
                    }
                    case "shell": { return new ShellPublishActions();
                    }
                    default: { return new NpmVersionActions();
                    }
                }
            };

            for (const pkg of ctx.packages) {
                const perPkg = ctx.perPackageConfig.get(pkg.name);
                const actionsId = resolveVersionActionsId(pkg, perPkg ?? {});
                let actions: ReturnType<typeof factory>;

                try {
                    actions = factory(actionsId);
                } catch {
                    continue;
                }

                let published: string | undefined;

                try {
                    // Some concrete actions accept an extra
                    // `perPackageConfig` field (maven / python /
                    // container). We pass it through for actions that
                    // consume it; the abstract base class signature is
                    // narrower, so we cast to bypass structural
                    // checking. The cast keeps `actions` as the
                    // receiver so `this` is preserved.
                    type ExtendedReadPublishedVersion = (this: typeof actions, context: {
                        perPackageConfig?: unknown;
                        pkg: typeof pkg;
                        pm: typeof ctx.pm;
                    }) => Promise<string | undefined>;

                    published = await (actions.readPublishedVersion as ExtendedReadPublishedVersion).call(
                        actions,
                        { perPackageConfig: perPkg, pkg, pm: ctx.pm },
                    );
                } catch {
                    // readPublishedVersion is a probe — failures
                    // collapse to undefined and we treat that as "not
                    // published" for this check. The publish-time path
                    // will surface real auth/network issues elsewhere.
                    continue;
                }

                if (published && published.length > 0) {
                    greenFindings.push(`${pkg.name} is already published at version ${published}.`);
                }
            }
        } catch (error) {
            greenFindings.push(`Could not probe published versions: ${(error as Error).message}.`);
        }

        if (greenFindings.length > 0) {
            checks.push({
                message: `--first-release is set but the workspace is NOT greenfield: ${greenFindings.join(" ")} Remove --first-release and run a normal release, or roll back the existing tags / unpublish before bootstrapping.`,
                name: "first-release.repo-not-greenfield",
                severity: "error",
                status: "fail",
            });
        } else {
            checks.push({
                message: "Workspace looks greenfield (no matching release tags, no published versions detected). Safe to use --first-release.",
                name: "first-release.repo-not-greenfield",
                severity: "info",
                status: "pass",
            });
        }
    }

    // gitlabHost: detect a likely-misconfiguration where the user set a
    // self-hosted GitLab host but the resolved provider isn't gitlab.
    if (ctx.config.gitlabHost) {
        const { detectRemoteProvider } = await import("../../../release/core/remote/detect");
        const { createShellRunner } = await import("../../../release/core/shell-runner");
        const provider = await detectRemoteProvider(cwd, createShellRunner(), ctx.config.provider);

        if (provider === "gitlab") {
            checks.push({
                message: `Self-hosted GitLab host configured: ${ctx.config.gitlabHost}.`,
                name: "gitlab-host",
                severity: "info",
                status: "pass",
            });
        } else {
            checks.push({
                message: `release.gitlabHost is set ("${ctx.config.gitlabHost}") but the resolved provider is "${provider}". The host will be ignored. Either set release.provider: "gitlab" or remove gitlabHost.`,
                name: "gitlab-host",
                severity: "warn",
                status: "fail",
            });
        }
    }

    // githubHost: same misconfiguration story as gitlabHost, plus an extra
    // check that `gh` is on PATH (Enterprise auth still requires the CLI).
    if (ctx.config.githubHost) {
        const { detectRemoteProvider } = await import("../../../release/core/remote/detect");
        const { createShellRunner } = await import("../../../release/core/shell-runner");
        const provider = await detectRemoteProvider(cwd, createShellRunner(), ctx.config.provider);

        if (provider === "github") {
            // gh CLI presence is a hard prerequisite for GitHub Enterprise
            // operations — the adapter shells out to it for every release /
            // PR API call. The earlier gh-cli-available check covers the
            // generic case; this is the Enterprise-specific call-out so
            // operators don't paste a host and assume it just works.
            const ghOnPath = await import("node:child_process").then(({ execSync }) => {
                try {
                    execSync("gh --version", { stdio: "ignore" });

                    return true;
                } catch {
                    return false;
                }
            });

            if (ghOnPath) {
                checks.push({
                    message: `Self-hosted GitHub Enterprise host configured: ${ctx.config.githubHost}.`,
                    name: "github-host",
                    severity: "info",
                    status: "pass",
                });
            } else {
                checks.push({
                    message: `release.githubHost is set ("${ctx.config.githubHost}") but the gh CLI is not on PATH. Install gh and run \`gh auth login --hostname ${ctx.config.githubHost}\` before releasing.`,
                    name: "github-host",
                    severity: "error",
                    status: "fail",
                });
            }
        } else {
            checks.push({
                message: `release.githubHost is set ("${ctx.config.githubHost}") but the resolved provider is "${provider}". The host will be ignored. Either set release.provider: "github" or remove githubHost.`,
                name: "github-host",
                severity: "warn",
                status: "fail",
            });
        }
    }

    // uv-aware Python packages (release-please #2560 / #2561).
    //
    // Per-package config carries `uvLockPath` (the operator wants vis
    // to know about a uv.lock the publish path shouldn't touch) and/or
    // `uvWorkspace.root` (the package is a uv workspace member). Both
    // are opt-in — the doctor only complains when the operator has
    // configured them but the on-disk state contradicts the config.
    {
        const fsModule = await import("node:fs/promises");
        const pathModule = await import("node:path");
        let lazyCheckUvWorkspaceMembership: typeof import("../../../release/core/version-actions/python").checkUvWorkspaceMembership | undefined;

        for (const pkg of ctx.packages) {
            const perPkg = ctx.perPackageConfig.get(pkg.name);

            if (!perPkg) {
                continue;
            }

            // uv.lock existence check. The lockfile path is recorded
            // (workspace-root-relative when the operator points at the
            // root; package-dir-relative for per-package locks) so
            // doctor can warn if it's missing despite the config —
            // typically the operator forgot to run `uv lock`.
            if (perPkg.uvLockPath) {
                const lockAbsolute = pathModule.isAbsolute(perPkg.uvLockPath)
                    ? perPkg.uvLockPath
                    : pathModule.join(pkg.dir, perPkg.uvLockPath);

                try {
                    await fsModule.access(lockAbsolute);
                    checks.push({
                        message: `uv.lock present at ${lockAbsolute}.`,
                        name: `uv-lockfile/${pkg.name}`,
                        severity: "info",
                        status: "pass",
                    });
                } catch {
                    checks.push({
                        message: `${pkg.name}: configured uvLockPath "${perPkg.uvLockPath}" doesn't exist (expected ${lockAbsolute}). Run \`uv lock\` to generate it, or remove uvLockPath if the lockfile lives elsewhere.`,
                        name: `uv-lockfile/${pkg.name}`,
                        severity: "warn",
                        status: "fail",
                    });
                }
            }

            // uv workspace membership check. The operator pointed the
            // package at a workspace root; verify the root's
            // [tool.uv.workspace] members lists it.
            if (perPkg.uvWorkspace?.root) {
                const rootAbsolute = pathModule.resolve(pkg.dir, perPkg.uvWorkspace.root);
                const memberRelative = pathModule.relative(rootAbsolute, pkg.dir).replaceAll("\\", "/");

                if (!lazyCheckUvWorkspaceMembership) {
                    ({ checkUvWorkspaceMembership: lazyCheckUvWorkspaceMembership } = await import("../../../release/core/version-actions/python"));
                }

                const outcome = await lazyCheckUvWorkspaceMembership(rootAbsolute, memberRelative);

                switch (outcome) {
                    case "member": {
                        checks.push({
                            message: `${pkg.name} is a member of the uv workspace rooted at ${rootAbsolute}.`,
                            name: `uv-workspace/${pkg.name}`,
                            severity: "info",
                            status: "pass",
                        });

                        break;
                    }
                    case "no-root-pyproject": {
                        checks.push({
                            message: `${pkg.name}: uvWorkspace.root points at ${rootAbsolute} but no pyproject.toml was found there. Verify the path is correct.`,
                            name: `uv-workspace/${pkg.name}`,
                            severity: "warn",
                            status: "fail",
                        });

                        break;
                    }
                    case "no-workspace": {
                        checks.push({
                            message: `${pkg.name}: uvWorkspace.root points at ${rootAbsolute} but that pyproject.toml has no [tool.uv.workspace] block. Add one with a "members" list, or drop the uvWorkspace setting.`,
                            name: `uv-workspace/${pkg.name}`,
                            severity: "warn",
                            status: "fail",
                        });

                        break;
                    }
                    default: {
                        checks.push({
                            message: `${pkg.name}: uv workspace root at ${rootAbsolute} has [tool.uv.workspace] but its "members" list doesn't include "${memberRelative}". Add the package to members or correct uvWorkspace.root.`,
                            name: `uv-workspace/${pkg.name}`,
                            severity: "warn",
                            status: "fail",
                        });
                    }
                }
            }
        }
    }

    await emit(logger, options, checks);

    const hasErrors = checks.some((c) => c.severity === "error" && c.status === "fail");

    process.exitCode = hasErrors ? 1 : 0;
};

const emit = async (
    logger: Toolbox<Console, ReleaseDoctorOptions>["logger"],
    options: ReleaseDoctorOptions,
    checks: Check[],
): Promise<void> => {
    if (options.json) {
        process.stdout.write(`${JSON.stringify({ checks }, null, 2)}\n`);

        return;
    }

    for (const check of checks) {
        const status = check.status === "pass" ? "✓" : check.status === "fail" ? "✗" : "—";
        const message = `${status}  [${check.severity}] ${check.name}: ${check.message}`;

        if (check.severity === "error" && check.status === "fail") {
            logger.error(message);
        } else if (check.severity === "warn" && check.status === "fail") {
            logger.warn(message);
        } else {
            logger.info(message);
        }
    }
};

export default execute as CommandExecute<Toolbox>;
