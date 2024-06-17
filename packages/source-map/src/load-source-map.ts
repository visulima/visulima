import { readFileSync } from "node:fs";

import type { TraceMap } from "@jridgewell/trace-mapping";
import { AnyMap } from "@jridgewell/trace-mapping";
import { dirname, resolve, toNamespacedPath } from "@visulima/path";

const INLINE_SOURCEMAP_REGEX = /^data:application\/json[^,]+base64,/;
// eslint-disable-next-line regexp/no-unused-capturing-group,regexp/no-super-linear-backtracking
const SOURCEMAP_REGEX = /\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+)[ \t]*$|\/\*[@#][ \t]+sourceMappingURL=([^*]+?)[ \t]*\*\/[ \t]*$/;

const isInlineMap = (url: string): boolean => INLINE_SOURCEMAP_REGEX.test(url);

const resolveSourceMapUrl = (sourceFile: string, sourcePath: string): string | undefined => {
    const lines = sourceFile.split(/\r?\n/);

    let sourceMapUrl = null;

    // eslint-disable-next-line no-loops/no-loops,no-plusplus
    for (let index = lines.length - 1; index >= 0 && !sourceMapUrl; index--) {
        // eslint-disable-next-line security/detect-object-injection
        sourceMapUrl = SOURCEMAP_REGEX.exec(lines[index] as string);
    }

    if (!sourceMapUrl) {
        return undefined;
    }

    return isInlineMap(sourceMapUrl[1] as string) ? (sourceMapUrl[1] as string) : (resolve(sourcePath, sourceMapUrl[1] as string) as string);
};

const decodeInlineMap = (data: string) => {
    const rawData = data.slice(data.indexOf(",") + 1);

    return Buffer.from(rawData, "base64").toString();
};

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
const loadSourceMap = (filename: string): TraceMap | undefined => {
    let sourceMapContent: string | undefined;

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        sourceMapContent = readFileSync(filename, { encoding: "utf8" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        error.message = `Error reading sourcemap for file "${toNamespacedPath(filename)}":\n${toNamespacedPath(error.message)}`;

        throw error;
    }

    const sourceMapUrl = resolveSourceMapUrl(sourceMapContent, dirname(filename));

    if (!sourceMapUrl) {
        return undefined;
    }

    let traceMapContent: string | undefined;

    // If it's an inline map, decode it and pass it through the same consumer factory
    if (isInlineMap(sourceMapUrl)) {
        traceMapContent = decodeInlineMap(sourceMapUrl);
    } else {
        try {
            // Load actual source map from given path
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            traceMapContent = readFileSync(sourceMapUrl, { encoding: "utf8" });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            error.message = `Error reading sourcemap for file "${toNamespacedPath(filename)}":\n${toNamespacedPath(error.message)}`;

            throw error;
        }
    }

    try {
        return new AnyMap(traceMapContent, sourceMapUrl);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        error.message = `Error parsing sourcemap for file "${toNamespacedPath(filename)}":\n${error.message}`;

        throw error;
    }
};

export default loadSourceMap;
