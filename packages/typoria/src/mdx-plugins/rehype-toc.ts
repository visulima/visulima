import type { Declaration, JSXElement } from "estree-jsx";
import type { Root } from "hast";
import { toEstree } from "hast-util-to-estree";
import type { Processor, Transformer } from "unified";

import visit from "./utils/hast-visit";

export interface RehypeTocOptions {
    /**
     * Export generated toc as a variable
     *
     * @defaultValue true
     */
    exportToc?: boolean;
}

// eslint-disable-next-line func-style
export function rehypeToc(this: Processor, { exportToc = true }: RehypeTocOptions = {}): Transformer<Root, Root> {
    return (tree) => {
        const output: {
            depth: number;
            title: JSXElement;
            url: string;
        }[] = [];

        visit(tree, ["h1", "h2", "h3", "h4", "h5", "h6"], (element) => {
            const id = element.properties.id as string | undefined;

            if (!id) {
                return "skip";
            }

            const estree = toEstree(element, {
                elementAttributeNameCase: "react",
                stylePropertyNameCase: "dom",
            });

            if (estree.body[0]?.type === "ExpressionStatement") {
                output.push({
                    depth: Number(element.tagName.slice(1)),
                    title: estree.body[0].expression as unknown as JSXElement,
                    url: `#${id}`,
                });
            }

            return "skip";
        });

        const declaration: Declaration = {
            declarations: [
                {
                    id: {
                        name: "toc",
                        type: "Identifier",
                    },
                    init: {
                        elements: output.map((item) => {
                            return {
                                properties: [
                                    {
                                        computed: false,
                                        key: {
                                            name: "depth",
                                            type: "Identifier",
                                        },
                                        kind: "init",
                                        method: false,
                                        shorthand: false,
                                        type: "Property",
                                        value: {
                                            type: "Literal",
                                            value: item.depth,
                                        },
                                    },
                                    {
                                        computed: false,
                                        key: {
                                            name: "url",
                                            type: "Identifier",
                                        },
                                        kind: "init",
                                        method: false,
                                        shorthand: false,
                                        type: "Property",
                                        value: {
                                            type: "Literal",
                                            value: item.url,
                                        },
                                    },
                                    {
                                        computed: false,
                                        key: {
                                            name: "title",
                                            type: "Identifier",
                                        },
                                        kind: "init",
                                        method: false,
                                        shorthand: false,
                                        type: "Property",
                                        value: {
                                            children: item.title.children,
                                            closingFragment: { type: "JSXClosingFragment" },
                                            openingFragment: { type: "JSXOpeningFragment" },
                                            type: "JSXFragment",
                                        },
                                    },
                                ],
                                type: "ObjectExpression",
                            };
                        }),
                        type: "ArrayExpression",
                    },
                    type: "VariableDeclarator",
                },
            ],
            kind: "const",
            type: "VariableDeclaration",
        };

        tree.children.push({
            data: {
                estree: {
                    body: [
                        exportToc
                            ? {
                                  declaration,
                                  specifiers: [],
                                  type: "ExportNamedDeclaration",
                              }
                            : declaration,
                    ],
                    comments: [],
                    sourceType: "module",
                    type: "Program",
                },
            },
            type: "mdxjsEsm",
            value: "",
        });
    };
}
