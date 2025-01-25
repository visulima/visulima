import type { Root, RootContent } from "mdast";
import type { Transformer } from "unified";
import { visit } from "unist-util-visit";

import flattenNode from "./utils/flatten-node";

export interface RemarkAdmonitionOptions {
    tag?: string;
    /**
     * Map type to another type
     */
    typeMap?: Record<string, string>;

    types?: string[];
}

/**
 * Remark Plugin to support Admonition syntax
 *
 * Useful when Migrating from Docusaurus
 */
export function remarkAdmonition(options: RemarkAdmonitionOptions = {}): Transformer<Root, Root> {
    const types = options.types ?? ["warn", "info", "error"];
    const tag = options.tag ?? ":::";
    // compatible with Docusaurus
    const typeMap = options.typeMap ?? {
        danger: "error",
        note: "info",
        tip: "info",
        warning: "warn",
    };

    function replaceNodes(nodes: RootContent[]): RootContent[] {
        if (nodes.length === 0) return nodes;
        let open = -1;
        let end = -1;

        const attributes = [];

        for (const [index, node] of nodes.entries()) {
            if (node.type !== "paragraph") continue;

            const text = flattenNode(node);
            const start = types.find((type) => text.startsWith(`${tag}${type}`));

            if (start) {
                if (open !== -1) throw new Error("Nested callout is not supported");
                open = index;

                attributes.push({
                    name: "type",
                    type: "mdxJsxAttribute",
                    value: start in typeMap ? typeMap[start] : start,
                });

                const rest = text.slice(`${tag}${start}`.length);
                if (rest.startsWith("[") && rest.endsWith("]")) {
                    attributes.push({
                        name: "title",
                        type: "mdxJsxAttribute",
                        value: rest.slice(1, -1),
                    });
                }
            }

            if (open !== -1 && text === tag) {
                end = index;
                break;
            }
        }

        if (open === -1 || end === -1) return nodes;

        return [
            ...nodes.slice(0, open),
            {
                attributes,
                children: nodes.slice(open + 1, end),
                name: "Callout",
                type: "mdxJsxFlowElement",
            } as RootContent,
            ...replaceNodes(nodes.slice(end + 1)),
        ];
    }

    return (tree) => {
        visit(tree, (node) => {
            if (!("children" in node)) return "skip";

            const result = replaceNodes(node.children);
            if (result === node.children) return;

            node.children = result;
            return "skip";
        });
    };
}
