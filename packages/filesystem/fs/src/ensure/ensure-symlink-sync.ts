import type { symlink } from "node:fs";
import { lstatSync, readlinkSync, statSync, symlinkSync } from "node:fs";

import { dirname, resolve, toNamespacedPath } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import { AlreadyExistsError } from "../error";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
// eslint-disable-next-line unicorn/prevent-abbreviations
import ensureDirSync from "./ensure-dir-sync";
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
 * @returns A void.
 * @example
 * ```javascript
 * import { ensureSymlinkSync } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * // Ensure a symlink /tmp/foo/link-to-bar.txt points to /tmp/foo/bar.txt
 * ensureSymlinkSync(join("/tmp", "foo", "bar.txt"), join("/tmp", "foo", "link-to-bar.txt"));
 *
 * // Ensure a directory symlink /tmp/foo/link-to-baz-dir points to /tmp/foo/baz-dir
 * ensureSymlinkSync(join("/tmp", "foo", "baz-dir"), join("/tmp", "foo", "link-to-baz-dir"), "dir");
 * ```
 */

// eslint-disable-next-line sonarjs/cognitive-complexity -- symlink creation requires multiple platform-specific checks
const ensureSymlinkSync = (target: URL | string, linkName: URL | string, type?: symlink.Type): void => {
    assertValidFileOrDirectoryPath(target);
    assertValidFileOrDirectoryPath(linkName);

    const targetRealPath = resolveSymlinkTarget(target, linkName);

    // eslint-disable-next-line no-param-reassign
    linkName = toNamespacedPath(toPath(linkName));

    try {
        const linkStatInfo = lstatSync(linkName);

        if (linkStatInfo.isSymbolicLink() && isStatsIdentical(statSync(targetRealPath), statSync(linkName))) {
            const sourceStat = statSync(targetRealPath);

            const destinationStat = statSync(linkName);

            if (isStatsIdentical(sourceStat, destinationStat)) {
                return;
            }
        }
    } catch {
        /* empty */
    }

    const sourceStatInfo = lstatSync(targetRealPath);
    const sourceFilePathType = getFileInfoType(sourceStatInfo);

    ensureDirSync(dirname(linkName));

    // Always use "junctions" on Windows. Even though support for "symbolic links" was added in Vista+, users by default
    // lack permission to create them
    let symlinkType: symlink.Type = type ?? "file";

    if (!type) {
        if (isWindows) {
            symlinkType = "junction";
        } else {
            symlinkType = sourceFilePathType === "dir" ? "dir" : "file";
        }
    }

    try {
        symlinkSync(toNamespacedPath(toPath(targetRealPath)), linkName, symlinkType);
    } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
            throw error;
        }

        const linkStatInfo = lstatSync(linkName);

        if (!linkStatInfo.isSymbolicLink()) {
            throw new AlreadyExistsError(`A ${String(getFileInfoType(linkStatInfo))} already exists at the path: ${linkName}`);
        }

        const linkPath = readlinkSync(linkName);
        const linkRealPath = toNamespacedPath(resolve(linkPath));

        if (linkRealPath !== targetRealPath) {
            throw new AlreadyExistsError(`A symlink targeting to an undesired path already exists: ${linkName} -> ${linkRealPath}`);
        }
    }
};

export default ensureSymlinkSync;
