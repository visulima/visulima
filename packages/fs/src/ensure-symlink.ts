import { lstat, readlink, symlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// eslint-disable-next-line unicorn/prevent-abbreviations
import ensureDir from "./ensure-dir";
import { AlreadyExistsError } from "./error";
import { getFileInfoType } from "./utils/get-file-info-type";
import resolveSymlinkTarget from "./utils/resolve-symlink-target";
import toPath from "./utils/to-path";

const isWindows = process.platform === "win32";

/**
 * Ensures that the link exists, and points to a valid file.
 * If the directory structure does not exist, it is created.
 * If the link already exists, it is not modified but error is thrown if it is not point to the given target.
 *
 * @param target the source file path
 * @param linkName the destination link path
 */
const ensureSymlink = async (target: URL | string, linkName: URL | string): Promise<void> => {
    const targetRealPath = resolveSymlinkTarget(target, linkName);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const sourceStatInfo = await lstat(targetRealPath);
    const sourceFilePathType = getFileInfoType(sourceStatInfo);

    await ensureDir(dirname(toPath(linkName)));

    const symlinkType: string | null = isWindows ? (sourceFilePathType === "dir" ? "dir" : "file") : null;

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await symlink(target, linkName, symlinkType);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (error.code !== "EEXIST") {
            throw error;
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const linkStatInfo = await lstat(linkName);

        if (!linkStatInfo.isSymbolicLink()) {
            const type = getFileInfoType(linkStatInfo);

            throw new AlreadyExistsError(`A '${type}' already exists at the path: ${toPath(linkName)}`);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const linkPath = await readlink(linkName);
        const linkRealPath = resolve(linkPath);

        if (linkRealPath !== targetRealPath) {
            throw new AlreadyExistsError(`A symlink targeting to an undesired path already exists: ${toPath(linkName)} -> ${linkRealPath}`);
        }
    }
};

export default ensureSymlink;
