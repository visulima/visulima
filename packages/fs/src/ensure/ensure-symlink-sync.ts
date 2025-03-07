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
 *
 * @param target the source file path
 * @param linkName the destination link path
 * @param type the type of the symlink, or null to use automatic detection
 * @returns A void.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const ensureSymlinkSync = (target: URL | string, linkName: URL | string, type?: symlink.Type): void => {
    assertValidFileOrDirectoryPath(target);
    assertValidFileOrDirectoryPath(linkName);

    const targetRealPath = resolveSymlinkTarget(target, linkName);

    // eslint-disable-next-line no-param-reassign
    linkName = toNamespacedPath(toPath(linkName));

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const linkStatInfo = lstatSync(linkName);

        if (
            linkStatInfo.isSymbolicLink() &&
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            isStatsIdentical(statSync(targetRealPath), statSync(linkName))
        ) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            const sourceStat = statSync(targetRealPath);
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            const destinationStat = statSync(linkName);

            if (isStatsIdentical(sourceStat, destinationStat)) {
                return;
            }
        }
    } catch {
        /* empty */
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const sourceStatInfo = lstatSync(targetRealPath);
    const sourceFilePathType = getFileInfoType(sourceStatInfo);

    ensureDirSync(dirname(linkName));

    // Always use "junctions" on Windows. Even though support for "symbolic links" was added in Vista+, users by default
    // lack permission to create them
    const symlinkType: symlink.Type | null = type ?? (isWindows ? "junction" : sourceFilePathType === "dir" ? "dir" : "file");

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        symlinkSync(toNamespacedPath(toPath(targetRealPath)), linkName, symlinkType);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (error.code !== "EEXIST") {
            throw error;
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const linkStatInfo = lstatSync(linkName);

        if (!linkStatInfo.isSymbolicLink()) {
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            throw new AlreadyExistsError("A " + getFileInfoType(linkStatInfo) + " already exists at the path: " + (linkName as string));
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const linkPath = readlinkSync(linkName);
        const linkRealPath = toNamespacedPath(resolve(linkPath));

        if (linkRealPath !== targetRealPath) {
            throw new AlreadyExistsError(
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                ("A symlink targeting to an undesired path already exists: " + (linkName as string) + " -> " + linkRealPath) as string,
            );
        }
    }
};

export default ensureSymlinkSync;
