/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/pathsAreEqual.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */
import splitPath from "./split-path";

/**
 * Compare two segment arrays, treating a `*` in the wildcard segments as
 * matching any single segment. The arrays must have the same length to match.
 * @param pathPieces The concrete path split into segments.
 * @param wildcardPieces The (possibly wildcarded) path split into segments.
 * @returns `true` when every segment matches (allowing `*` wildcards), otherwise `false`.
 */
const segmentsAreEqual = (pathPieces: ReadonlyArray<string>, wildcardPieces: ReadonlyArray<string>): boolean => {
    if (pathPieces.length !== wildcardPieces.length) {
        return false;
    }

    for (const [index, wildcardPiece] of wildcardPieces.entries()) {
        if (wildcardPiece !== "*" && wildcardPiece !== pathPieces[index]) {
            return false;
        }
    }

    return true;
};

/**
 * PathsAreEqual returns true if the path and wildcardPath are equal.
 *
 * Both paths are split honouring backslash-escaped dots, and a `*` segment in
 * `wildcardPath` matches any single segment in `path`.
 * @param path The path to compare.
 * @param wildcardPath The wildcard path to compare.
 * @returns True if the path and wildcardPath are equal, false otherwise.
 */
const pathsAreEqual = (path: string, wildcardPath: string): boolean => segmentsAreEqual(splitPath(path), splitPath(wildcardPath));

export { segmentsAreEqual };

export default pathsAreEqual;
