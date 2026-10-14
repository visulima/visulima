/**
 * Bundled-subdirectory executor (`remote:bundled`).
 *
 * An organization ships templates inside its `@org/create` package. The package
 * tarball is downloaded with giget (which strips the tarball's top-level directory),
 * and the validated subdirectory is copied into the target. Symlinks are never copied,
 * and the source is realpath-checked so it cannot resolve outside the extracted package.
 */

import { cpSync, lstatSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { isAbsolute, join, relative, resolve, sep } from "@visulima/path";
import { downloadTemplate } from "giget";

import { pail } from "../../../io/logger";
import type { ExecutionContext, TemplateConfig } from "./types";

/**
 * Copy a template subdirectory out of a downloaded package tarball.
 * @param config Resolved config: `source` is the tarball URL, `subdir` the package-relative path.
 * @param context Runtime context with the target directory and createConfig.
 * @returns Exit code — 0 on success, 1 on failure.
 */
export const executeBundledTemplate = async (config: TemplateConfig, context: ExecutionContext): Promise<number> => {
    const subdir = config.subdir ?? "";
    const workDir = mkdtempSync(join(tmpdir(), "vis-bundled-"));

    try {
        // No preferOffline: giget's tarball cache is keyed by the URL basename, so two orgs
        // shipping `create-1.0.0.tgz` would share one cache file. The URL is version-pinned already.
        await downloadTemplate(config.source, { dir: workDir, force: true });

        const root = realpathSync(workDir);
        const source = realpathSync(resolve(root, subdir));
        const rel = relative(root, source);

        if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
            throw new Error(`bundled path "${subdir}" resolves outside the package`);
        }

        cpSync(source, context.targetDir, {
            filter: (path) => !lstatSync(path).isSymbolicLink(),
            recursive: true,
        });

        pail.info(`Copied bundled template "${subdir}"`);

        return 0;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        pail.warn(`Failed to scaffold bundled template: ${message}`);

        return 1;
    } finally {
        rmSync(workDir, { force: true, recursive: true });
    }
};
