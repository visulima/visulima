import { createFilter } from "@rollup/pluginutils";
import type { Pail } from "@visulima/pail";
import type { Node, ObjectExpression, Property } from "estree";
import { walk } from "estree-walker";
import MagicString from "magic-string";
import type { Plugin } from "rollup";

interface PropertyLiteralValue extends Property {
    end: number;
    key: {
        type: "Literal";
        value: string;
    };
    start: number;
    type: "Property";
    value: {
        type: "Literal";
        value: string;
    };
}

export type JSXRemoveAttributesPlugin = {
    attributes: string[];
};

export const jsxRemoveAttributes = ({ attributes, logger }: JSXRemoveAttributesPlugin & { logger: Pail<never, string> }): Plugin => {
    const filter = createFilter([/\.[tj]sx$/], /node_modules/);

    if (!Array.isArray(attributes) || attributes.length === 0) {
        throw new Error("[packem:jsx-remove-attributes]: attributes must be a non-empty array of strings.");
    }

    return {
        name: "packem:jsx-remove-attributes",
        transform(code: string, id: string) {
            if (!filter(id)) {
                return null;
            }

            /**
             * rollup's built-in parser returns an extended version of ESTree Node.
             */
            let ast: Node | null = null;

            try {
                ast = this.parse(code, { allowReturnOutsideFunction: true }) as Node;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                this.warn({
                    code: "PARSE_ERROR",
                    message: `[packem:jsx-remove-attributes]: failed to parse "${id}" and remove the jsx attribute.`,
                });

                logger.warn(error);

                return null;
            }

            // MagicString's `hasChanged()` is slow, so we track the change manually
            let hasChanged = false;

            const magicString: MagicString = new MagicString(code);

            walk(ast, {
                enter(node) {
                    if (node?.type === "CallExpression" && node?.callee?.type === "Identifier" && node?.callee?.name === "jsx") {
                        const filteredArguments = node.arguments.filter(
                            (argument) => argument?.type === "ObjectExpression" && Array.isArray(argument?.properties),
                        ) as ObjectExpression[];

                        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
                        for (const object of filteredArguments) {
                            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
                            for (const property of object.properties) {
                                if (
                                    property.type === "Property" &&
                                    property.key.type === "Literal" &&
                                    property.value.type === "Literal" &&
                                    attributes.includes(property.key.value as string)
                                ) {
                                    // -2 to remove the comma and the space before the property
                                    magicString.overwrite((property as PropertyLiteralValue).start - 2, (property as PropertyLiteralValue).end, "");
                                    hasChanged = true;
                                }
                            }
                        }
                    }
                },
            });

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!hasChanged) {
                return null;
            }

            return { code: magicString.toString(), map: null };
        },
    };
};
