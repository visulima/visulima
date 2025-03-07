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
 *
 * @param target the source file path
 * @param linkName the destination link path
 * @param type the type of the symlink, or null to use automatic detection
 * @returns A void promise that resolves once the link exists.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const ensureSymlink = async (target: URL | string, linkName: URL | string, type?: symlinkSync.Type): Promise<void> => {
    assertValidFileOrDirectoryPath(target);
    assertValidFileOrDirectoryPath(linkName);

    const targetRealPath = resolveSymlinkTarget(target, linkName);

    // eslint-disable-next-line no-param-reassign
    linkName = toNamespacedPath(toPath(linkName));

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const linkStatInfo = await lstat(linkName);

        if (
            linkStatInfo.isSymbolicLink() &&
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            isStatsIdentical(await stat(targetRealPath), await stat(linkName))
        ) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            const [sourceStat, destinationStat] = await Promise.all([stat(targetRealPath), stat(linkName)]);

            if (isStatsIdentical(sourceStat, destinationStat)) {
                return;
            }
        }
    } catch {
        /* empty */
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const sourceStatInfo = await lstat(targetRealPath);
    const sourceFilePathType = getFileInfoType(sourceStatInfo);

    await ensureDir(dirname(linkName));

    // Always use "junctions" on Windows. Even though support for "symbolic links" was added in Vista+, users by default
    // lack permission to create them
    const symlinkType: string | null = type ?? (isWindows ? "junction" : sourceFilePathType === "dir" ? "dir" : "file");

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await symlink(toNamespacedPath(toPath(targetRealPath)), linkName, symlinkType);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (error.code !== "EEXIST") {
            throw error;
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const linkStatInfo = await lstat(linkName);

        if (!linkStatInfo.isSymbolicLink()) {
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            throw new AlreadyExistsError("A " + getFileInfoType(linkStatInfo) + " already exists at the path: " + (linkName as string));
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const linkPath = await readlink(linkName);
        const linkRealPath = toNamespacedPath(resolve(linkPath));

        if (linkRealPath !== targetRealPath) {
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            throw new AlreadyExistsError("A symlink targeting to an undesired path already exists: " + (linkName as string) + " -> " + linkRealPath);
        }
    }
};

export default ensureSymlink;
