/**
 * `npm` adapter — also the universal publisher (RFC §11.3).
 *
 * Publishing always normalises to `npm publish &lt;tarball>` regardless of
 * which manager packed, because:
 *   - yarn won't accept tarballs in `yarn npm publish` (always re-packs)
 *   - bun lacks OIDC + provenance support
 *   - npm publish is the lowest-common-denominator that works with foreign tarballs
 */

import { join } from "node:path";

import { VisReleaseError } from "../../errors";
import type {
    InstallLockfileOnlyOptions,
    PackOptions,
    PackResult,
    PublishOptions,
    PublishResult,
    WorkspaceListEntry,
} from "./interface";
import { PackageManagerAdapter } from "./interface";

export class NpmAdapter extends PackageManagerAdapter {
    public readonly id = "npm" as const;

    public readonly minVersion = "11.5.1"; // OIDC trusted publishing GA

    public async pack(options: PackOptions): Promise<PackResult> {
        const args = ["pack", "--json"];

        if (options.destination) {
            args.push("--pack-destination", options.destination);
        }

        const result = await this.runner.run("npm", args, { cwd: options.cwd, silent: true });

        if (result.exitCode !== 0) {
            throw new VisReleaseError({
                code: "PUBLISH_FAILED",
                message: `npm pack failed: ${result.stderr || result.stdout}`,
            });
        }

        // npm pack --json emits an array; first entry has `filename`.
        const parsed: { filename?: string }[] = JSON.parse(result.stdout);
        const filename = parsed[0]?.filename;

        if (!filename) {
            throw new VisReleaseError({
                code: "PUBLISH_FAILED",
                hint: "Upgrade npm to a version that emits --json output, or report this with the raw stdout.",
                message: `npm pack: could not parse output: ${result.stdout}`,
            });
        }

        const dest = options.destination ?? options.cwd;
        let tarball = join(dest, filename);

        if (options.filename) {
            const fs = await import("node:fs/promises");

            await fs.rename(tarball, join(dest, options.filename));
            tarball = join(dest, options.filename);
        }

        return { raw: parsed, tarball };
    }

    public async installLockfileOnly(options: InstallLockfileOnlyOptions): Promise<void> {
        const result = await this.runner.run("npm", ["install", "--package-lock-only"], { cwd: options.cwd, silent: options.silent });

        if (result.exitCode !== 0) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `npm install --package-lock-only failed: ${result.stderr || result.stdout}`,
            });
        }
    }

    public async listWorkspacePackages(cwd: string): Promise<WorkspaceListEntry[]> {
        // `npm query .workspace --json` returns an array of workspace manifests.
        const result = await this.runner.run("npm", ["query", ".workspace", "--json"], { cwd, silent: true });

        if (result.exitCode !== 0) {
            return [];
        }

        try {
            const parsed: { location?: string; name?: string; path?: string; private?: boolean; version?: string }[] = JSON.parse(result.stdout);

            return parsed
                .filter((p): p is Required<Pick<typeof p, "name">> & typeof p => typeof p.name === "string")
                .map((p) => {
                    return {
                        name: p.name,
                        path: p.path ?? p.location ?? cwd,
                        private: p.private ?? false,
                        version: p.version ?? "0.0.0",
                    };
                });
        } catch {
            return [];
        }
    }

    public async publish(options: PublishOptions): Promise<PublishResult> {
        // Staged publishing (npm CLI ≥ 11.15.0): `npm stage publish` puts the
        // version into a review state — invisible to consumers until a human
        // runs `npm stage approve` (or `vis release stage approve`). Same
        // flags as `npm publish`; OIDC + provenance both supported.
        const args = options.stage ? ["stage", "publish", options.tarball] : ["publish", options.tarball];

        if (options.tag) {
            args.push("--tag", options.tag);
        }

        if (options.access) {
            args.push("--access", options.access);
        }

        if (options.registry) {
            args.push("--registry", options.registry);
        }

        if (options.otp) {
            args.push("--otp", options.otp);
        }

        if (options.provenance) {
            args.push("--provenance");
        }

        // Force JSON when staging so we can capture the stage-id reliably.
        if (options.stage) {
            args.push("--json");
        }

        for (const extra of options.extraArgs ?? []) {
            args.push(extra);
        }

        // Silent mode so the shell runner captures stdout/stderr and runs them
        // through redactTokens before they surface in logs. Inherited stdio
        // would stream secrets (npm `_authToken`, registry-side EOTP echoes,
        // OIDC headers) straight to the terminal unscrubbed.
        const result = await this.runner.run("npm", args, { cwd: process.cwd(), silent: true });

        if (result.exitCode === 0) {
            const base: PublishResult = { output: result.stdout, published: true };

            if (options.stage) {
                // npm stage publish --json: { id, package, version, tag, ... }.
                // Best-effort parse — falls through to published-without-id if
                // a future CLI changes the shape.
                try {
                    const parsed = JSON.parse(result.stdout) as { id?: string; stageId?: string };

                    base.stageId = parsed.id ?? parsed.stageId;
                } catch {
                    // ignore — registry returned non-JSON despite --json
                }
            }

            return base;
        }

        const combined = `${result.stdout}\n${result.stderr}`;

        // npm registry returns 403 EPUBLISHCONFLICT for already-published versions.
        if (/EPUBLISHCONFLICT|cannot publish over the previously published versions|forbidden.*409/i.test(combined)) {
            return { alreadyPublished: true, output: combined, published: false };
        }

        throw new VisReleaseError({
            code: "PUBLISH_FAILED",
            message: `npm publish failed: ${combined}`,
        });
    }

    public async detectVersion(cwd: string): Promise<string | undefined> {
        const result = await this.runner.run("npm", ["--version"], { cwd, silent: true });

        return result.exitCode === 0 ? result.stdout.trim() : undefined;
    }
}
