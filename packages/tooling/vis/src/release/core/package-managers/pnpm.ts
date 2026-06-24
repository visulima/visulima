/**
 * `pnpm` adapter — the manager visulima itself uses.
 *
 * Pack: `pnpm pack --json`. Workspace listing: `pnpm -r ls --depth -1 --json`.
 * Reads `pnpm-workspace.yaml` for catalog blocks (only manager that does).
 *
 * Publish delegates to `NpmAdapter.publish` per the npm-publish-tarball
 * strategy in RFC §11.3 (tested as the reliable path). Override at the
 * pipeline level if `publishStrategy: "native"` is configured.
 */

import { isAbsolute, join } from "node:path";

import { VisReleaseError } from "../../errors";
import type { InstallLockfileOnlyOptions, PackOptions, PackResult, PublishNativeOptions, PublishOptions, PublishResult, WorkspaceListEntry } from "./interface";
import { PackageManagerAdapter } from "./interface";
import { interpretNativePublishResult, NpmAdapter } from "./npm";

export class PnpmAdapter extends PackageManagerAdapter {
    public readonly id = "pnpm" as const;

    public readonly minVersion = "9.5.0"; // catalog protocol GA

    public async pack(options: PackOptions): Promise<PackResult> {
        const args = ["pack", "--json"];

        if (options.destination) {
            args.push("--pack-destination", options.destination);
        }

        const result = await this.runner.run("pnpm", args, { cwd: options.cwd, silent: true });

        if (result.exitCode !== 0) {
            throw new VisReleaseError({
                code: "PUBLISH_FAILED",
                message: `pnpm pack failed: ${result.stderr || result.stdout}`,
            });
        }

        // pnpm pack --json: { name, version, filename, files: [...] }
        const parsed: { filename?: string } = JSON.parse(result.stdout);
        const { filename } = parsed;

        if (!filename) {
            throw new VisReleaseError({
                code: "PUBLISH_FAILED",
                message: `pnpm pack: could not parse output: ${result.stdout}`,
            });
        }

        const dest = options.destination ?? options.cwd;
        let tarball = isAbsolute(filename) ? filename : join(dest, filename);

        if (options.filename) {
            const fs = await import("node:fs/promises");

            await fs.rename(tarball, join(dest, options.filename));
            tarball = join(dest, options.filename);
        }

        return { raw: parsed, tarball };
    }

    public async installLockfileOnly(options: InstallLockfileOnlyOptions): Promise<void> {
        const result = await this.runner.run("pnpm", ["install", "--lockfile-only"], { cwd: options.cwd, silent: options.silent });

        if (result.exitCode !== 0) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `pnpm install --lockfile-only failed: ${result.stderr || result.stdout}`,
            });
        }
    }

    public async listWorkspacePackages(cwd: string): Promise<WorkspaceListEntry[]> {
        const result = await this.runner.run("pnpm", ["-r", "ls", "--depth", "-1", "--json"], { cwd, silent: true });

        if (result.exitCode !== 0) {
            return [];
        }

        try {
            const parsed: { name?: string; path?: string; private?: boolean; version?: string }[] = JSON.parse(result.stdout);

            return parsed
                .filter((p): p is Required<Pick<typeof p, "name">> & typeof p => typeof p.name === "string")
                .map((p) => {
                    return {
                        name: p.name,
                        path: p.path ?? cwd,
                        private: p.private ?? false,
                        version: p.version ?? "0.0.0",
                    };
                });
        } catch {
            return [];
        }
    }

    public async publish(options: PublishOptions): Promise<PublishResult> {
        // Delegate to npm CLI per RFC §11.3 (LCD path).
        return new NpmAdapter(this.runner).publish(options);
    }

    public override async publishNative(options: PublishNativeOptions): Promise<PublishResult> {
        // `pnpm publish` packs + publishes from the package dir and resolves
        // `catalog:` / `workspace:` natively. `--no-git-checks` because the
        // release wave runs with a dirty tree (versions just written).
        const args = ["publish", "--no-git-checks"];

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

        for (const extra of options.extraArgs ?? []) {
            args.push(extra);
        }

        const result = await this.runner.run("pnpm", args, { cwd: options.cwd, silent: true });

        return interpretNativePublishResult(result, "pnpm publish");
    }

    public async detectVersion(cwd: string): Promise<string | undefined> {
        const result = await this.runner.run("pnpm", ["--version"], { cwd, silent: true });

        return result.exitCode === 0 ? result.stdout.trim() : undefined;
    }

    public override async readCatalogYaml(cwd: string): Promise<string | undefined> {
        const fs = await import("node:fs/promises");

        try {
            return await fs.readFile(join(cwd, "pnpm-workspace.yaml"), "utf8");
        } catch {
            return undefined;
        }
    }
}
