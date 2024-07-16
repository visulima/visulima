/**
 * Modified copy of https://github.com/mesqueeb/filter-anything/blob/main/src/pathsAreEqual.ts
 *
 * MIT License
 *
 * Copyright (c) 2018 Luca Ban - Mesqueeb
 */
const pathsAreEqual = (path: string, wildcardPath: string): boolean => {
    const wildcardPathPieces = wildcardPath.split(".");
    const pathWithWildcards = path
        .split(".")
        // eslint-disable-next-line unicorn/no-array-reduce
        .reduce<string[]>((carry, piece, index) => {
            // eslint-disable-next-line security/detect-object-injection
            const add = wildcardPathPieces[index] === "*" ? "*" : piece;

            carry.push(add);

            return carry;
        }, [])
        .join(".");
    return pathWithWildcards === wildcardPath;
};

export default pathsAreEqual;
