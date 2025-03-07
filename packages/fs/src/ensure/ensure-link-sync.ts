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
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        destinationStat = lstatSync(destination);
    } catch {
        // ignore error
    }

    let sourceStat;

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        sourceStat = lstatSync(source);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.message = error.message.replace("lstat", "ensureLink");

        throw error;
    }

    if (destinationStat && isStatsIdentical(sourceStat, destinationStat)) {
        return;
    }

    ensureDirSync(dirname(destination));

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    linkSync(source, destination);
};

export default ensureLinkSync;
