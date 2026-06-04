import { readFileSync } from "node:fs";
import { dirname, resolve, toNamespacedPath } from "node:path";
import { pathToFileURL } from "node:url";

import type { TraceMap } from "@jridgewell/trace-mapping";
import { AnyMap } from "@jridgewell/trace-mapping";

const INLINE_SOURCEMAP_REGEX = /^data:application\/json[^,]+base64,/;
const REMOTE_URL_REGEX = /^[a-z][a-z0-9+.-]*:\/\//i;
// eslint-disable-next-line regexp/no-super-linear-backtracking, sonarjs/regex-complexity, sonarjs/slow-regex
const SOURCEMAP_REGEX = /\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+)[ \t]*$|\/\*[@#][ \t]+sourceMappingURL=([^*]+?)[ \t]*\*\/[ \t]*$/;
const LINE_SPLIT_REGEX = /\r?\n/;

const isInlineMap = (url: string): boolean => INLINE_SOURCEMAP_REGEX.test(url);

const enhanceError = (error: unknown, context: string): never => {
    const message = error instanceof Error ? error.message : String(error);
    const enhancedMessage = `${context}:\n${message}`;

    throw new Error(enhancedMessage);
};

const resolveSourceMapUrl = (sourceFile: string, sourcePath: string): string | undefined => {
    const lines = sourceFile.split(LINE_SPLIT_REGEX);

    let sourceMapUrl: RegExpExecArray | undefined;

    // eslint-disable-next-line no-plusplus
    for (let index = lines.length - 1; index >= 0 && !sourceMapUrl; index--) {
        sourceMapUrl = SOURCEMAP_REGEX.exec(lines[index] as string) ?? undefined;
    }

    if (!sourceMapUrl) {
        return undefined;
    }

    const url = sourceMapUrl[1] ?? sourceMapUrl[2];

    if (!url) {
        return undefined;
    }

    if (isInlineMap(url)) {
        return url;
    }

    // Unsupported data: URI variants (e.g. URL-encoded, non-base64) are not decodable here; skip rather than treat as a path.
    if (/^data:/i.test(url)) {
        return undefined;
    }

    // A remote (e.g. http/https) sourceMappingURL cannot be read from the local filesystem.
    if (REMOTE_URL_REGEX.test(url) && !url.startsWith("file:")) {
        return undefined;
    }

    return resolve(sourcePath, url);
};

const decodeInlineMap = (data: string) => {
    const rawData = data.slice(data.indexOf(",") + 1);

    return Buffer.from(rawData, "base64").toString();
};

const loadSourceMap = (filename: string): TraceMap | undefined => {
    let sourceMapContent: string | undefined;

    try {
        sourceMapContent = readFileSync(filename, { encoding: "utf8" });
    } catch (error: unknown) {
        enhanceError(error, `Error reading sourcemap for file "${toNamespacedPath(filename)}"`);
    }

    // TypeScript narrows undefined after the enhanceError check above
    const sourceMapUrl = resolveSourceMapUrl(sourceMapContent as string, dirname(filename));

    if (!sourceMapUrl) {
        return undefined;
    }

    let traceMapContent: string | undefined;

    const inline = isInlineMap(sourceMapUrl);

    // If it's an inline map, decode it and pass it through the same consumer factory
    if (inline) {
        traceMapContent = decodeInlineMap(sourceMapUrl);
    } else {
        try {
            // Load actual source map from given path
            traceMapContent = readFileSync(sourceMapUrl, { encoding: "utf8" });
        } catch (error: unknown) {
            enhanceError(error, `Error reading sourcemap for file "${toNamespacedPath(filename)}"`);
        }
    }

    try {
        const mapBaseUrl = inline ? sourceMapUrl : pathToFileURL(sourceMapUrl).href;

        return new AnyMap(traceMapContent as string, mapBaseUrl);
    } catch (error: unknown) {
        enhanceError(error, `Error parsing sourcemap for file "${toNamespacedPath(filename)}"`);
    }

    // unreachable, but needed for TypeScript to understand this function always returns or throws
    return undefined;
};

export default loadSourceMap;
