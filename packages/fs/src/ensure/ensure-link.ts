import { link, lstat } from "node:fs/promises";

import { dirname, toNamespacedPath } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
// eslint-disable-next-line unicorn/prevent-abbreviations
import ensureDir from "./ensure-dir";
import isStatsIdentical from "./utils/is-stats-identical";

/**
 * Ensures that the hard link exists.
 * If the directory structure does not exist, it is created.
 * @param source The path to the source file or directory.
 * @param destination The path to the destination link.
 * @example
 * ```javascript
 * import { ensureLink } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * // ensure the link /tmp/foo/bar-link.txt points to /tmp/foo/bar.txt
 * await ensureLink(join("/tmp", "foo", "bar.txt"), join("/tmp", "foo", "bar-link.txt"));
 * ```
 */
const ensureLink = async (source: URL | string, destination: URL | string): Promise<void> => {
    assertValidFileOrDirectoryPath(source);
    assertValidFileOrDirectoryPath(destination);

    // eslint-disable-next-line no-param-reassign
    source = toNamespacedPath(toPath(source));
    // eslint-disable-next-line no-param-reassign
    destination = toNamespacedPath(toPath(destination));

    let destinationStat;

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        destinationStat = await lstat(destination);
    } catch {
        // ignore error
    }

    let sourceStat;

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        sourceStat = await lstat(source);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.message = error.message.replace("lstat", "ensureLink");

        throw error;
    }

    if (destinationStat && isStatsIdentical(sourceStat, destinationStat)) {
        return;
    }

    await ensureDir(dirname(destination));

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await link(source, destination);
};

export default ensureLink;
