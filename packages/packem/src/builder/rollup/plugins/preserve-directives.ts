import type { Node } from "estree";
import MagicString from "magic-string";
import { extname } from "pathe";
import type { Plugin, RenderedChunk } from "rollup";

import logger from "../../../logger";

const availableESExtensionsRegex = /\.(m|c)?(j|t)sx?$/;
const directiveRegex = /^use \w+$/;

const preserveDirectives = (): Plugin => {
    const directives: Record<string, Set<string>> = {};

    return {
        name: "packem:preserve-directives",

        onLog(level, log) {
            if (log.code === "MODULE_LEVEL_DIRECTIVE" && level === "warn") {
                return false;
            }

            return null;
        },

        renderChunk(code, chunk, { sourcemap }) {
            /**
             * chunk.moduleIds is introduced in rollup 3
             * Add a fallback for rollup 2
             */
            const moduleIds = "moduleIds" in chunk ? chunk.moduleIds : Object.keys((chunk as RenderedChunk).modules);

            const outputDirectives = moduleIds
                .map((id) => {
                    if (directives[id]) {
                        return directives[id];
                    }

                    return null;
                })
                .reduce<Set<string>>((accumulator, directives) => {
                    if (directives) {
                        directives.forEach((directive) => accumulator.add(directive));
                    }
                    return accumulator;
                }, new Set());

            // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
            let magicString: MagicString | undefined;

            if (outputDirectives.size > 0) {
                magicString ||= new MagicString(code);
                magicString.prepend(
                    `${[...outputDirectives]
                        .map((directive) => `'${directive}';`)
                        .join("\n")}\n`,
                );
            }

            // Neither outputDirectives is present, no change is needed
            if (magicString === undefined) {
                return null;
            }

            return {
                code: magicString.toString(),
                map: sourcemap ? magicString.generateMap({ hires: true }) : null,
            };
        },

        transform: {
            handler(code, id) {
                const extension = extname(id);

                if (!availableESExtensionsRegex.test(extension)) {
                    return null;
                }

                // MagicString's `hasChanged()` is slow, so we track the change manually
                let hasChanged = false;

                /**
                 * rollup's built-in parser returns an extended version of ESTree Node.
                 */
                let ast: Node | null = null;

                try {
                    ast = this.parse(code, { allowReturnOutsideFunction: true }) as Node;
                } catch (error: any) {
                    this.warn({
                        code: "PARSE_ERROR",
                        message: `[packem:preserve-directives]: failed to parse "${id}" and extract the directives.`,
                    });

                    logger.warn(error);

                    return null;
                }

                // Exit if the root of the AST is not a Program
                if (ast.type !== "Program") {
                    return null;
                }

                const magicString: MagicString = new MagicString(code);

                // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
                for (const node of ast.body) {
                    // Only parse the top level directives, once reached to the first non statement literal node, stop parsing
                    if (node.type !== "ExpressionStatement") {
                        break;
                    }

                    let directive: string | null = null;

                    /**
                     * rollup and estree defines `directive` field on the `ExpressionStatement` node:
                     * https://github.com/rollup/rollup/blob/fecf0cfe14a9d79bb0eff4ad475174ce72775ead/src/ast/nodes/ExpressionStatement.ts#L10
                     */
                    if ("directive" in node) {
                        directive = node.directive;
                    } else if (node.expression.type === "Literal" && typeof node.expression.value === "string" && directiveRegex.test(node.expression.value)) {
                        directive = node.expression.value;
                    }

                    if (directive) {
                        directives[id] ||= new Set<string>();
                        // eslint-disable-next-line security/detect-object-injection
                        (directives[id] as Set<string>).add(directive);

                        /**
                         * rollup has extended acorn node with the `start` and the `end` field
                         * https://github.com/rollup/rollup/blob/fecf0cfe14a9d79bb0eff4ad475174ce72775ead/src/ast/nodes/shared/Node.ts#L33
                         *
                         * However, typescript doesn't know that, so we add type guards for typescript
                         * to infer.
                         */
                        if ("start" in node && typeof node.start === "number" && "end" in node && typeof node.end === "number") {
                            magicString.remove(node.start, node.end);

                            hasChanged = true;
                        }
                    }
                }

                if (!hasChanged) {
                    // If nothing has changed, we can avoid the expensive `toString()` and `generateMap()` calls
                    return null;
                }

                return {
                    code: magicString.toString(),
                    map: magicString.generateMap({ hires: true }),
                    meta: {
                        preserveDirectives: {
                            // eslint-disable-next-line security/detect-object-injection
                            directives: [...(directives[id] ?? [])],
                        },
                    },
                };
            },
            order: "post",
        },
    };
}

export default preserveDirectives;
