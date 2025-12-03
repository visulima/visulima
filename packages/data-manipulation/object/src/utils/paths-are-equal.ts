/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/pathsAreEqual.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */

/**
 * PathsAreEqual returns true if the path and wildcardPath are equal.
 * @param path The path to compare
 * @param wildcardPath The wildcard path to compare
 * @returns True if the path and wildcardPath are equal, false otherwise.
 */
const pathsAreEqual = (path: string, wildcardPath: string): boolean => {
    const wildcardPathPieces = wildcardPath.split(".");
    const pathWithWildcards = path
        .split(".")
        // eslint-disable-next-line unicorn/no-array-reduce
        .reduce<string[]>((carry, piece, index) => {
            const add = wildcardPathPieces[index] === "*" ? "*" : piece;

            carry.push(add);

            return carry;
        }, [])
        .join(".");

    return pathWithWildcards === wildcardPath;
};

export default pathsAreEqual;
