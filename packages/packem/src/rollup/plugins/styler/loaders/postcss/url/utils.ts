import type { Declaration } from "postcss";
import type { Node, ParsedValue } from "postcss-value-parser";
import valueParser from "postcss-value-parser";

const urlFunctionRe = /^url$/i;
const imageSetFunctionRe = /^(?:-webkit-)?image-set$/i;

export const isDeclWithUrl = (decl: Declaration): boolean => /(?:url|(?:-webkit-)?image-set)\(/i.test(decl.value);

export const walkUrls = (parsed: ParsedValue, callback: (url: string, node?: Node) => void): void => {
    parsed.walk((node) => {
        if (node.type !== "function") {
            return;
        }

        if (urlFunctionRe.test(node.value)) {
            const { nodes } = node;
            const [urlNode] = nodes;
            const url = urlNode?.type === "string" ? urlNode.value : valueParser.stringify(nodes);

            callback(url.replaceAll(/^\s+|\s+$/g, ""), urlNode);

            return;
        }

        if (imageSetFunctionRe.test(node.value)) {
            for (const nNode of node.nodes) {
                if (nNode.type === "string") {
                    callback(nNode.value.replaceAll(/^\s+|\s+$/g, ""), nNode);
                    continue;
                }

                if (nNode.type === "function" && urlFunctionRe.test(nNode.value)) {
                    const { nodes } = nNode;
                    const [urlNode] = nodes;
                    const url = urlNode?.type === "string" ? urlNode.value : valueParser.stringify(nodes);

                    callback(url.replaceAll(/^\s+|\s+$/g, ""), urlNode);

                    continue;
                }
            }
        }
    });
};
