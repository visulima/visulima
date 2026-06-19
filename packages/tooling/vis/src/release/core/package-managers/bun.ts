/**
 * `bun` adapter.
 *
 * Quirks per RFC §11.3:
 *   - No OIDC trusted publishing.
 *   - No `--provenance`. We strip the flag silently when active pm is bun.
 *   - Workspace publish + protocol rewriting requires bun >= 1.1.36.
 *   - Pack: `bun pm pack`.
 *   - Lockfile-only install: `bun install --lockfile-only`.
 *
 * Publish delegates to `npm publish &lt;tarball>` per RFC §11.3 because
 * we want OIDC + provenance available even on bun-managed projects.
 */

import { readdir, readFile, rename } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";

import zeptomatch from "zeptomatch";

import { VisReleaseError } from "../../errors";
import type {
    InstallLockfileOnlyOptions,
    PackOptions,
    PackResult,
    PublishNativeOptions,
    PublishOptions,
    PublishResult,
    WorkspaceListEntry,
} from "./interface";
import { PackageManagerAdapter } from "./interface";
import { interpretNativePublishResult, NpmAdapter } from "./npm";

export class BunAdapter extends PackageManagerAdapter {
    public readonly id = "bun" as const;

    public readonly minVersion = "1.1.36"; // workspace publish + protocol rewriting

    public async pack(options: PackOptions): Promise<PackResult> {
        const args = ["pm", "pack"];

        if (options.destination) {
            args.push("--destination", options.destination);
        }

        // `bun pm pack --filename` was added after the bun version this adapter
        // declares as `minVersion` (1.1.36); the flag isn't available there
        // and `--destination` already covers the only call sites that pass it.
        // We rename the tarball post-pack instead if a filename override is
        // requested, so the interface contract still holds for bun consumers.

        const result = await this.runner.run("bun", args, { cwd: options.cwd, silent: true });

        if (result.exitCode !== 0) {
            throw new VisReleaseError({
                code: "PUBLISH_FAILED",
                message: `bun pm pack failed: ${result.stderr || result.stdout}`,
            });
        }

        // bun pm pack: stdout includes the tarball filename; parse from output.
        const filenameMatch = /(?:^|["'\s])([^\s"']*\.tgz)/m.exec(result.stdout);
        const dest = options.destination ?? options.cwd;

        let producedTarball: string;

        if (filenameMatch?.[1]) {
            const tarballName = filenameMatch[1];

            // `isAbsolute` (not `startsWith("/")`) so a Windows absolute path
            // like `C:\…\pkg.tgz` parsed from bun's stdout isn't re-joined onto
            // `dest`, which would produce a doubled `dest\C:\…` path.
            producedTarball = isAbsolute(tarballName) ? tarballName : join(dest, tarballName);
        } else {
            // Fallback: derive from package.json
            const pkgJson = JSON.parse(
                await readFile(join(options.cwd, "package.json"), "utf8"),
            ) as { name?: string; version?: string };

            const safeName = (pkgJson.name ?? "package").replaceAll("/", "-").replace(/^@/, "");

            producedTarball = join(dest, `${safeName}-${pkgJson.version ?? "0.0.0"}.tgz`);
        }

        // Honour `options.filename` by renaming after the fact — the bun
        // version this adapter pins to lacks `bun pm pack --filename`.
        if (options.filename && basename(producedTarball) !== options.filename) {
            const renamed = join(dest, options.filename);

            await rename(producedTarball, renamed);
            producedTarball = renamed;
        }

        return { raw: result.stdout, tarball: producedTarball };
    }

    public async installLockfileOnly(options: InstallLockfileOnlyOptions): Promise<void> {
        const result = await this.runner.run("bun", ["install", "--lockfile-only"], { cwd: options.cwd, silent: options.silent });

        if (result.exitCode !== 0) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `bun install --lockfile-only failed: ${result.stderr || result.stdout}`,
            });
        }
    }

    public async listWorkspacePackages(cwd: string): Promise<WorkspaceListEntry[]> {
        // bun has no first-class workspace list command (as of 1.2.x).
        // Read the root package.json's `workspaces` glob and walk the matched directories.
        try {
            const root = JSON.parse(await readFile(join(cwd, "package.json"), "utf8")) as {
                workspaces?: string[] | { packages?: string[] };
            };

            const globs = Array.isArray(root.workspaces) ? root.workspaces : root.workspaces?.packages ?? [];

            if (globs.length === 0) {
                return [];
            }

            // Naive walker: enumerate every directory under cwd up to a sensible depth,
            // testing each against the workspace globs. Skips node_modules + dotfiles.
            const matched = new Set<string>();
            const queue: string[] = ["."];
            const maxDepth = 5;
            const seen = new Set<string>();

            while (queue.length > 0) {
                const rel = queue.shift()!;

                if (seen.has(rel)) {
                    continue;
                }

                seen.add(rel);

                const depth = rel === "." ? 0 : rel.split("/").length;

                if (depth > maxDepth) {
                    continue;
                }

                let entries: { isDirectory: () => boolean; name: string }[];

                try {
                    entries = await readdir(join(cwd, rel), { withFileTypes: true });
                } catch {
                    continue;
                }

                for (const entry of entries) {
                    if (!entry.isDirectory()) {
                        continue;
                    }

                    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
                        continue;
                    }

                    const childRel = rel === "." ? entry.name : `${rel}/${entry.name}`;

                    // Match against any workspace glob — record the match,
                    // but always keep traversing so nested workspace patterns
                    // are still discovered.
                    if (globs.some((glob) => zeptomatch(glob, childRel))) {
                        matched.add(childRel);
                    }

                    queue.push(childRel);
                }
            }

            const out: WorkspaceListEntry[] = [];

            for (const rel of matched) {
                const manifestPath = join(cwd, rel, "package.json");

                try {
                    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { name?: string; private?: boolean; version?: string };

                    if (typeof manifest.name !== "string") {
                        continue;
                    }

                    out.push({
                        name: manifest.name,
                        path: join(cwd, rel),
                        private: manifest.private ?? false,
                        version: manifest.version ?? "0.0.0",
                    });
                } catch {
                    // skip unreadable manifests
                }
            }

            return out;
        } catch {
            return [];
        }
    }

    public async publish(options: PublishOptions): Promise<PublishResult> {
        // Bun lacks OIDC + provenance; always delegate to npm CLI.
        return new NpmAdapter(this.runner).publish(options);
    }

    public override async publishNative(options: PublishNativeOptions): Promise<PublishResult> {
        // `bun publish` packs + publishes from the package dir. Bun has no
        // `--provenance` and no OIDC, and ignores `--otp`; the version-action
        // emits a compatibility warning when those are requested under native
        // strategy. We still forward `--tag`/`--access`/`--registry`.
        const args = ["publish"];

        if (options.tag) {
            args.push("--tag", options.tag);
        }

        if (options.access) {
            args.push("--access", options.access);
        }

        if (options.registry) {
            args.push("--registry", options.registry);
        }

        for (const extra of options.extraArgs ?? []) {
            args.push(extra);
        }

        const result = await this.runner.run("bun", args, { cwd: options.cwd, silent: true });

        return interpretNativePublishResult(result, "bun publish");
    }

    public async detectVersion(cwd: string): Promise<string | undefined> {
        const result = await this.runner.run("bun", ["--version"], { cwd, silent: true });

        return result.exitCode === 0 ? result.stdout.trim() : undefined;
    }
}
