import type { symlink as symlinkSync } from "node:fs";
import { lstat, readlink, stat, symlink } from "node:fs/promises";

import { dirname, resolve, toNamespacedPath } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import { AlreadyExistsError } from "../error";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
// eslint-disable-next-line unicorn/prevent-abbreviations
import ensureDir from "./ensure-dir";
import { getFileInfoType } from "./utils/get-file-info-type";
import isStatsIdentical from "./utils/is-stats-identical";
import resolveSymlinkTarget from "./utils/resolve-symlink-target";

const isWindows = process.platform === "win32" || /^(?:msys|cygwin)$/.test(<string>process.env.OSTYPE);

/**
 * Ensures that the link exists, and points to a valid file.
 * If the directory structure does not exist, it is created.
 * If the link already exists, it is not modified but error is thrown if it is not point to the given target.
 * @param target the source file path
 * @param linkName the destination link path
 * @param type the type of the symlink, or null to use automatic detection
 * @returns A void promise that resolves once the link exists.
 * @example
 * ```javascript
 * import { ensureSymlink } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * // Ensure a symlink /tmp/foo/link-to-bar.txt points to /tmp/foo/bar.txt
 * await ensureSymlink(join("/tmp", "foo", "bar.txt"), join("/tmp", "foo", "link-to-bar.txt"));
 *
 * // Ensure a directory symlink /tmp/foo/link-to-baz-dir points to /tmp/foo/baz-dir
 * await ensureSymlink(join("/tmp", "foo", "baz-dir"), join("/tmp", "foo", "link-to-baz-dir"), "dir");
 * ```
 */

const ensureSymlink = async (target: URL | string, linkName: URL | string, type?: symlinkSync.Type): Promise<void> => {
    assertValidFileOrDirectoryPath(target);
    assertValidFileOrDirectoryPath(linkName);

    const targetRealPath = resolveSymlinkTarget(target, linkName);

    // eslint-disable-next-line no-param-reassign
    linkName = toNamespacedPath(toPath(linkName));

    try {
        const linkStatInfo = await lstat(linkName);

        if (linkStatInfo.isSymbolicLink() && isStatsIdentical(await stat(targetRealPath), await stat(linkName))) {
            const [sourceStat, destinationStat] = await Promise.all([stat(targetRealPath), stat(linkName)]);

            if (isStatsIdentical(sourceStat, destinationStat)) {
                return;
            }
        }
    } catch {
        /* empty */
    }

    const sourceStatInfo = await lstat(targetRealPath);
    const sourceFilePathType = getFileInfoType(sourceStatInfo);

    await ensureDir(dirname(linkName));

    // Always use "junctions" on Windows. Even though support for "symbolic links" was added in Vista+, users by default
    // lack permission to create them
    const symlinkType: string | null = type ?? (isWindows ? "junction" : sourceFilePathType === "dir" ? "dir" : "file");

    try {
        await symlink(toNamespacedPath(toPath(targetRealPath)), linkName, symlinkType);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error.code !== "EEXIST") {
            throw error;
        }

        const linkStatInfo = await lstat(linkName);

        if (!linkStatInfo.isSymbolicLink()) {
            throw new AlreadyExistsError(`A ${getFileInfoType(linkStatInfo)} already exists at the path: ${linkName as string}`);
        }

        const linkPath = await readlink(linkName);
        const linkRealPath = toNamespacedPath(resolve(linkPath));

        if (linkRealPath !== targetRealPath) {
            throw new AlreadyExistsError(`A symlink targeting to an undesired path already exists: ${linkName as string} -> ${linkRealPath}`);
        }
    }
};

export default ensureSymlink;
