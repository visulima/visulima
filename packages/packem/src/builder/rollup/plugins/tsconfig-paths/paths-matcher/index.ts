import type { TsConfigResult } from "@visulima/package/tsconfig";
import { dirname,join, resolve } from "pathe";

import type { PathEntry,StarPattern } from "./types.js";
import assertStarCount from "./utils/assert-star-count";
import isPatternMatch from "./utils/is-pattern-match";
import parsePattern from "./utils/parse-pattern";

const implicitBaseUrlSymbol = Symbol('implicitBaseUrl');

const parsePaths = (paths: Partial<Record<string, string[]>>, baseUrl: string | undefined, absoluteBaseUrl: string) =>
    Object.entries(paths).map(([pattern, substitutions]) => {
        assertStarCount(pattern, `Pattern '${pattern}' can have at most one '*' character.`);

        return {
            pattern: parsePattern(pattern),
            substitutions: substitutions!.map((substitution) => {
                assertStarCount(substitution, `Substitution '${substitution}' in pattern '${pattern}' can have at most one '*' character.`);

                if (!baseUrl && !isRelativePathPattern.test(substitution)) {
                    throw new Error("Non-relative paths are not allowed when 'baseUrl' is not set. Did you forget a leading './'?");
                }

                return resolve(absoluteBaseUrl, substitution);
            }),
        } as PathEntry<StarPattern | string>;
    });

/**
 * Reference:
 * https://github.com/microsoft/TypeScript/blob/3ccbe804f850f40d228d3c875be952d94d39aa1d/src/compiler/moduleNameResolver.ts#L2465
 */
const createPathsMatcher = (tsconfig: TsConfigResult) => {
    if (!tsconfig.config.compilerOptions) {
        return null;
    }

    const { baseUrl, paths } = tsconfig.config.compilerOptions;
    const implicitBaseUrl = implicitBaseUrlSymbol in tsconfig.config.compilerOptions && (tsconfig.config.compilerOptions[implicitBaseUrlSymbol] as string);
    if (!baseUrl && !paths) {
        return null;
    }

    const resolvedBaseUrl = resolve(dirname(tsconfig.path), baseUrl || implicitBaseUrl || ".");

    const pathEntries = paths ? parsePaths(paths, baseUrl, resolvedBaseUrl) : [];

    return (specifier: string) => {
        if (isRelativePathPattern.test(specifier)) {
            return [];
        }

        const patternPathEntries: PathEntry<StarPattern>[] = [];

        for (const pathEntry of pathEntries) {
            if (pathEntry.pattern === specifier) {
                return pathEntry.substitutions.map(slash);
            }

            if (typeof pathEntry.pattern !== "string") {
                patternPathEntries.push(pathEntry as PathEntry<StarPattern>);
            }
        }

        let matchedValue: PathEntry<StarPattern> | undefined;
        let longestMatchPrefixLength = -1;

        for (const pathEntry of patternPathEntries) {
            if (isPatternMatch(pathEntry.pattern, specifier) && pathEntry.pattern.prefix.length > longestMatchPrefixLength) {
                longestMatchPrefixLength = pathEntry.pattern.prefix.length;
                matchedValue = pathEntry;
            }
        }

        if (!matchedValue) {
            return baseUrl ? [slash(join(resolvedBaseUrl, specifier))] : [];
        }

        const matchedPath = specifier.slice(matchedValue.pattern.prefix.length, specifier.length - matchedValue.pattern.suffix.length);

        return matchedValue.substitutions.map((substitution) => slash(substitution.replace("*", matchedPath)));
    };
};

export default createPathsMatcher;
