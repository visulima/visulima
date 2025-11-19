import { linkSync, lstatSync } from "node:fs";

import { dirname, toNamespacedPath } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
// eslint-disable-next-line unicorn/prevent-abbreviations
import ensureDirSync from "./ensure-dir-sync";
import isStatsIdentical from "./utils/is-stats-identical";

/**
 * Ensures that the hard link exists.
 * If the directory structure does not exist, it is created.
 * @param source The path to the source file or directory.
 * @param destination The path to the destination link.
 * @example
 * ```javascript
 * import { ensureLinkSync } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * // ensure the link /tmp/foo/bar-link.txt points to /tmp/foo/bar.txt
 * ensureLinkSync(join("/tmp", "foo", "bar.txt"), join("/tmp", "foo", "bar-link.txt"));
 * ```
 */
const ensureLinkSync = (source: URL | string, destination: URL | string): void => {
    assertValidFileOrDirectoryPath(source);
    assertValidFileOrDirectoryPath(destination);

    // eslint-disable-next-line no-param-reassign
    source = toNamespacedPath(toPath(source));
    // eslint-disable-next-line no-param-reassign
    destination = toNamespacedPath(toPath(destination));

    let destinationStat;

    try {
        destinationStat = lstatSync(destination);
    } catch {
        // ignore error
    }

    let sourceStat;

    try {
        sourceStat = lstatSync(source);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        error.message = error.message.replace("lstat", "ensureLink");

        throw error;
    }

    if (destinationStat && isStatsIdentical(sourceStat, destinationStat)) {
        return;
    }

    ensureDirSync(dirname(destination));

    linkSync(source, destination);
};

export default ensureLinkSync;
