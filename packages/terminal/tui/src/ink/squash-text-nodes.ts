import type { DOMElement, DOMNode } from "./dom";
import sanitizeAnsi from "./sanitize-ansi";

export type CharOffsetRange = { end: number; start: number };
export type CharOffsetMap = Map<DOMNode, CharOffsetRange>;

// Squashing text nodes allows to combine multiple text nodes into one and write
// to `Output` instance only once. For example, <Text>hello{' '}world</Text>
// is actually 3 text nodes, which would result 3 writes to `Output`.
//
// Also, this is necessary for libraries like ink-link (https://github.com/sindresorhus/ink-link),
// which need to wrap all children at once, instead of wrapping 3 text nodes separately.
const squashTextNodes = (node: DOMElement): string => {
    let text = "";

    for (let index = 0; index < node.childNodes.length; index++) {
        const childNode = node.childNodes[index];

        if (childNode === undefined) {
            continue;
        }

        let nodeText = "";

        if (childNode.nodeName === "#text") {
            nodeText = childNode.nodeValue;
        } else {
            if (childNode.nodeName === "ink-text" || childNode.nodeName === "ink-virtual-text") {
                nodeText = squashTextNodes(childNode);
            }

            // Since these text nodes are being concatenated, `Output` instance won't be able to
            // apply children transform, so we have to do it manually here for each text node
            if (nodeText.length > 0 && typeof childNode.internal_transform === "function") {
                nodeText = childNode.internal_transform(nodeText, index);
            }
        }

        text += nodeText;
    }

    return sanitizeAnsi(text);
};

export default squashTextNodes;

/**
 * Squash text nodes while building a character offset map.
 * Each DOM node is mapped to its start/end character offsets in the resulting string.
 * Used for selection text extraction and cursor position calculation.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
export const squashTextNodesWithMap = (node: DOMElement, map: CharOffsetMap, offsetRef: { current: number }): string => {
    // Use cached text if available
    if (node.internal_textCache) {
        const { map: cachedMap, text } = node.internal_textCache;

        for (const [k, v] of cachedMap.entries()) {
            map.set(k, {
                end: v.end + offsetRef.current,
                start: v.start + offsetRef.current,
            });
        }

        offsetRef.current += text.length;

        return text;
    }

    let text = "";
    const localMap: CharOffsetMap = new Map();
    const localOffsetRef = { current: 0 };

    for (let index = 0; index < node.childNodes.length; index++) {
        const childNode = node.childNodes[index];

        if (childNode === undefined) {
            continue;
        }

        let nodeText = "";
        const startOffset = localOffsetRef.current;

        if (childNode.nodeName === "#text") {
            nodeText = childNode.nodeValue;
            localMap.set(childNode, {
                end: startOffset + nodeText.length,
                start: startOffset,
            });
            localOffsetRef.current += nodeText.length;
        } else {
            if (childNode.nodeName === "ink-text" || childNode.nodeName === "ink-virtual-text") {
                nodeText = squashTextNodesWithMap(childNode, localMap, localOffsetRef);
                localMap.set(childNode, {
                    end: localOffsetRef.current,
                    start: startOffset,
                });
            }

            if (nodeText.length > 0 && typeof childNode.internal_transform === "function") {
                nodeText = childNode.internal_transform(nodeText, index);
            }
        }

        text += nodeText;
    }

    // Cache the result on the node
    node.internal_textCache = {
        map: localMap,
        text,
    };

    for (const [k, v] of localMap.entries()) {
        map.set(k, {
            end: v.end + offsetRef.current,
            start: v.start + offsetRef.current,
        });
    }

    offsetRef.current += text.length;

    return text;
};
