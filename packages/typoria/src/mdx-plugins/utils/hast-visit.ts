import type { Element, Root, RootContent } from "hast";

/**
 * Visit a node with filtered tag names
 */
const visit = (node: Root | RootContent, tagNames: string[], handler: (node: Element) => "skip" | undefined): void => {
    if (node.type === "element" && tagNames.includes(node.tagName)) {
        const result = handler(node);

        if (result === "skip") {
            return;
        }
    }

    if ("children" in node)
        node.children.forEach((n) => {
            visit(n, tagNames, handler);
        });
};

export default visit;
