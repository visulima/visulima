/**
 * Modified copy of https://github.com/vitejs/vite/blob/main/packages/vite/rollup.dts.config.ts#L64
 */
import { exit } from "node:process";

import { parse } from "@babel/parser";
import { walk } from "estree-walker";
import MagicString from "magic-string";
import { findStaticImports } from "mlly";
import type { Plugin, PluginContext, RenderedChunk } from "rollup";

import logger from "../../../logger";

// Taken from https://stackoverflow.com/a/36328890
// eslint-disable-next-line security/detect-unsafe-regex
const multilineCommentsRE = /\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g;
const licenseCommentsRE = /MIT License|MIT license|BSD license/;
const consecutiveNewlinesRE = /\n{2,}/g;
const identifierWithTrailingDollarRE = /\b(\w+)\$\d+\b/g;

const escapeRegexRE = /[-/\\^$*+?.()|[\]{}]/g;
const escapeRegex = (string_: string): string => string_.replaceAll(escapeRegexRE, "\\$&");

const unique = <T>(array: T[]): T[] => [...new Set(array)];

const cleanUnnecessaryComments = (code: string) =>
    code.replaceAll(multilineCommentsRE, (m) => (licenseCommentsRE.test(m) ? "" : m)).replaceAll(consecutiveNewlinesRE, "\n\n");

const calledDtsFiles = new Map<string, boolean>();

/**
 * Rollup deduplicate type names with a trailing `$1` or `$2`, which can be
 * confusing when showed in autocompletions. Try to replace with a better name
 */
// eslint-disable-next-line func-style
function replaceConfusingTypeNames(this: PluginContext, code: string, chunk: RenderedChunk, { identifierReplacements }: PatchTypesOptions) {
    const imports = findStaticImports(code);

    // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
    for (const moduleName in identifierReplacements) {
        // eslint-disable-next-line @typescript-eslint/no-shadow,@typescript-eslint/no-unsafe-return
        const imp = imports.find((imp) => imp.specifier === moduleName && imp.imports.includes("{"));

        // Validate that `identifierReplacements` is not outdated if there's no match
        if (!imp) {
            this.warn(`${chunk.fileName} does not import "${moduleName}" for replacement`);

            process.exitCode = 1;

            // eslint-disable-next-line no-continue
            continue;
        }

        // eslint-disable-next-line security/detect-object-injection
        const replacements = identifierReplacements[moduleName];

        // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
        for (const id in replacements) {
            // Validate that `identifierReplacements` is not outdated if there's no match
            if (!imp.imports.includes(id)) {
                this.warn(`${chunk.fileName} does not import "${id}" from "${moduleName}" for replacement`);

                exit(1);
            }

            // eslint-disable-next-line security/detect-object-injection
            const betterId = replacements[id] as string;
            const regexEscapedId = escapeRegex(id);

            // If the better id accesses a namespace, the existing `Foo as Foo$1`
            // named import cannot be replaced with `Foo as Namespace.Foo`, so we
            // pre-emptively remove the whole named import
            if (betterId.includes(".")) {
                // eslint-disable-next-line no-param-reassign,@rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
                code = code.replace(new RegExp(`\\b\\w+\\b as ${regexEscapedId},?\\s?`), "");
            }

            // eslint-disable-next-line no-param-reassign,@rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
            code = code.replaceAll(new RegExp(`\\b${regexEscapedId}\\b`, "g"), betterId);
        }
    }

    const unreplacedIds = unique(Array.from(code.matchAll(identifierWithTrailingDollarRE), (m) => m[0]));

    if (unreplacedIds.length > 0) {
        const unreplacedString = unreplacedIds.map((id) => `\n- ${id}`).join("");

        const fileWithoutExtension = chunk.fileName.replace(/\.[^/.]+$/, "");

        // Display the warning only once per file
        if (!calledDtsFiles.has(fileWithoutExtension)) {
            logger.warn({
                message: `${chunk.fileName} contains confusing identifier names${unreplacedString}\n\nTo replace these, add them to the "patchTypes -> identifierReplacements" option in your packem config.`,
                prefix: "patch-types",
            });
        }

        calledDtsFiles.set(fileWithoutExtension, true);
    }

    return code;
}

/**
 * Remove `@internal` comments not handled by `compilerOptions.stripInternal`
 * Reference: https://github.com/vuejs/core/blob/main/rollup.dts.config.js
 */
// eslint-disable-next-line func-style,@typescript-eslint/no-explicit-any
function removeInternal(s: MagicString, node: any): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-return
    if (node.leadingComments?.some((c: any) => c.type === "CommentBlock" && c.value.includes("@internal"))) {
        // Examples:
        // function a(foo: string, /* @internal */ bar: number)
        //                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^
        // strip trailing comma
        const end = s.original[node.end] === "," ? node.end + 1 : node.end;

        s.remove(node.leadingComments[0].start, end);

        return true;
    }

    return false;
}

/**
 * While we already enable `compilerOptions.stripInternal`, some internal comments
 * like internal parameters are still not stripped by TypeScript, so we run another
 * pass here.
 */
// eslint-disable-next-line func-style
function stripInternalTypes(this: PluginContext, code: string, chunk: RenderedChunk) {
    if (code.includes("@internal")) {
        const s = new MagicString(code);
        const ast = parse(code, {
            plugins: ["typescript"],
            sourceType: "module",
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        walk(ast as any, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            enter(node: any) {
                if (removeInternal(s, node)) {
                    this.skip();
                }
            },
        });

        // eslint-disable-next-line no-param-reassign
        code = s.toString();

        if (code.includes("@internal")) {
            this.warn(`${chunk.fileName} has unhandled @internal declarations`);

            exit(1);
        }
    }

    return code;
}

export interface PatchTypesOptions {
    identifierReplacements?: Record<string, Record<string, string>>;
}

/**
 * Patch the types files before passing to dts plugin
 * 1. Resolve `types/*` imports
 * 2. Validate unallowed dependency imports
 * 3. Replace confusing type names
 * 4. Strip leftover internal types
 * 5. Clean unnecessary comments
 */
export const patchTypescriptTypes = (options: PatchTypesOptions): Plugin => {
    return {
        name: "packem:patch-types",
        renderChunk(code, chunk) {
            // eslint-disable-next-line no-param-reassign
            code = replaceConfusingTypeNames.call(this, code, chunk, options);
            // eslint-disable-next-line no-param-reassign
            code = stripInternalTypes.call(this, code, chunk);
            // eslint-disable-next-line no-param-reassign
            code = cleanUnnecessaryComments(code);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return code;
        },
        resolveId(id) {
            // Ambient types are unbundled and externalized
            if (id.startsWith("types/")) {
                return {
                    external: true,
                    id: "../../" + (id.endsWith(".js") ? id : id + ".js"),
                };
            }

            return null;
        },
    };
};
