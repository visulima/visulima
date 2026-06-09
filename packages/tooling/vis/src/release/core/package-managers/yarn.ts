/**
 * `yarn` (Berry / v4+) adapter.
 *
 * Quirks per RFC §11.4:
 *   - Default tarball name is `package.tgz`, not `&lt;name>-&lt;v>.tgz`. Use
 *     `--out '%s-%v.tgz'` to normalise.
 *   - `yarn npm publish &lt;tarball>` is undocumented/unreliable — always
 *     re-packs. Publish always delegates to `npm publish &lt;tarball>`.
 *   - `workspace:*` rewrites to `=&lt;version&gt;` natively. We re-rewrite to
 *     `^&lt;version&gt;` in the publish-pipeline normalisation step (not here).
 *   - Lockfile-only install: `yarn install --mode update-lockfile`.
 *
 * Yarn Classic (v1) is unsupported; only Berry/v4 onward.
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
import { NpmAdapter } from "./npm";

export class YarnAdapter extends PackageManagerAdapter {
    public readonly id = "yarn" as const;

    public readonly minVersion = "4.0.0"; // Berry only

    public async pack(options: PackOptions): Promise<PackResult> {
        const dest = options.destination ?? options.cwd;
        const filename = options.filename ?? "%s-%v.tgz";
        const args = ["pack", "--out", join(dest, filename)];

        const result = await this.runner.run("yarn", args, { cwd: options.cwd, silent: true });

        if (result.exitCode !== 0) {
            throw new VisReleaseError({
                code: "PUBLISH_FAILED",
                message: `yarn pack failed: ${result.stderr || result.stdout}`,
            });
        }

        // yarn pack writes to whatever --out resolves to. Re-derive that here.
        const fs = await import("node:fs/promises");
        const path = await import("node:path");

        // %s/%v get expanded by yarn at write time. Read package.json to compute.
        const pkgJson = JSON.parse(
            await fs.readFile(path.join(options.cwd, "package.json"), "utf8"),
        ) as { name?: string; version?: string };

        const expanded = filename
            .replaceAll("%s", (pkgJson.name ?? "package").replaceAll("/", "-").replace(/^@/, ""))
            .replaceAll("%v", pkgJson.version ?? "0.0.0");

        return { raw: result.stdout, tarball: join(dest, expanded) };
    }

    public async installLockfileOnly(options: InstallLockfileOnlyOptions): Promise<void> {
        const result = await this.runner.run("yarn", ["install", "--mode", "update-lockfile"], { cwd: options.cwd, silent: options.silent });

        if (result.exitCode !== 0) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `yarn install --mode update-lockfile failed: ${result.stderr || result.stdout}`,
            });
        }
    }

    public async listWorkspacePackages(cwd: string): Promise<WorkspaceListEntry[]> {
        const result = await this.runner.run("yarn", ["workspaces", "list", "--json"], { cwd, silent: true });

        if (result.exitCode !== 0) {
            return [];
        }

        // yarn emits NDJSON: one `{"location":"...","name":"..."}` per line.
        const out: WorkspaceListEntry[] = [];

        for (const line of result.stdout.split(/\r?\n/)) {
            const trimmed = line.trim();

            if (!trimmed) {
                continue;
            }

            try {
                const parsed: { location?: string; name?: string } = JSON.parse(trimmed);

                if (typeof parsed.name !== "string" || parsed.name === "") {
                    continue;
                }

                out.push({
                    name: parsed.name,
                    path: parsed.location ? join(cwd, parsed.location) : cwd,
                    private: false,
                    version: "0.0.0",
                });
            } catch {
                // skip malformed lines
            }
        }

        return out;
    }

    public async publish(options: PublishOptions): Promise<PublishResult> {
        // Yarn doesn't accept tarball paths in `yarn npm publish`. Delegate to npm.
        return new NpmAdapter(this.runner).publish(options);
    }

    public async detectVersion(cwd: string): Promise<string | undefined> {
        const result = await this.runner.run("yarn", ["--version"], { cwd, silent: true });

        return result.exitCode === 0 ? result.stdout.trim() : undefined;
    }
}
