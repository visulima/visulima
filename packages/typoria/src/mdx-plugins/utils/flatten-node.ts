import type { RootContent } from "mdast";

const flattenNode = (node: RootContent): string => {
    if ("children" in node) {
        return node.children.map((child) => flattenNode(child)).join("");
    }

    if ("value" in node) {
        return node.value;
    }

    return "";
}

export default flattenNode;
