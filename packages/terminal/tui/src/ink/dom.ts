/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-use-before-define, import/exports-last, no-param-reassign, unicorn/no-null, unicorn/prefer-dom-node-remove */
import type { Node as YogaNode } from "yoga-layout";
import Yoga from "yoga-layout";

import measureText from "./measure-text.js";
import type { OutputTransformer } from "./render-node-to-output.js";
import squashTextNodes from "./squash-text-nodes.js";
import type { Styles } from "./styles.js";
import wrapText from "./wrap-text.js";

type InkNode = {
    internal_static?: boolean;
    parentNode: DOMElement | undefined;
    style: Styles;
    yogaNode?: YogaNode;
};

type LayoutListener = () => void;

export type TextName = "#text";
export type ElementNames = "ink-root" | "ink-box" | "ink-text" | "ink-cursor" | "ink-virtual-text";

export type NodeNames = ElementNames | TextName;

export type CursorAnchorRef = {
    readonly current: DOMElement | undefined | null;
};

export type CursorMarker = {
    anchorRef?: CursorAnchorRef;
    inline?: boolean;
    x: number;
    y: number;
};

export type DOMElement = InkNode & {
    attributes: Record<string, DOMNodeAttribute>;
    childNodes: DOMNode[];
    internal_accessibility?: {
        role?:
            | "button"
            | "checkbox"
            | "combobox"
            | "list"
            | "listbox"
            | "listitem"
            | "menu"
            | "menuitem"
            | "option"
            | "progressbar"
            | "radio"
            | "radiogroup"
            | "tab"
            | "tablist"
            | "table"
            | "textbox"
            | "timer"
            | "toolbar";
        state?: {
            busy?: boolean;
            checked?: boolean;
            disabled?: boolean;
            expanded?: boolean;
            multiline?: boolean;
            multiselectable?: boolean;
            readonly?: boolean;
            required?: boolean;
            selected?: boolean;
        };
    };
    internal_layoutListeners?: Set<LayoutListener>;

    internal_cursor?: CursorMarker;

    internal_hidden?: boolean;

    internal_transform?: OutputTransformer;

    // Internal properties
    isStaticDirty?: boolean;
    nodeName: ElementNames;
    onComputeLayout?: () => void;
    onImmediateRender?: () => void;
    onRender?: () => void;
    staticNode?: DOMElement;
};

export type TextNode = InkNode & {
    nodeName: TextName;
    nodeValue: string;
};

export type DOMNode<T = { nodeName: NodeNames }> = T extends {
    nodeName: infer U;
}
    ? U extends "#text"
        ? TextNode
        : DOMElement
    : never;

export type DOMNodeAttribute = boolean | string | number;

export const createNode = (nodeName: ElementNames): DOMElement => {
    const node: DOMElement = {
        attributes: {},
        childNodes: [],

        internal_accessibility: {},
        nodeName,
        parentNode: undefined,
        style: {},
        yogaNode: nodeName === "ink-virtual-text" || nodeName === "ink-cursor" ? undefined : Yoga.Node.create(),
    };

    if (nodeName === "ink-text") {
        node.yogaNode?.setMeasureFunc(measureTextNode.bind(null, node));
    }

    return node;
};

export const appendChildNode = (node: DOMElement, childNode: DOMElement): void => {
    if (childNode.parentNode) {
        removeChildNode(childNode.parentNode, childNode);
    }

    childNode.parentNode = node;
    node.childNodes.push(childNode);

    if (childNode.yogaNode) {
        node.yogaNode?.insertChild(childNode.yogaNode, node.yogaNode.getChildCount());
    }

    if (node.nodeName === "ink-text" || node.nodeName === "ink-virtual-text") {
        markNodeAsDirty(node);
    }
};

export const insertBeforeNode = (node: DOMElement, newChildNode: DOMNode, beforeChildNode: DOMNode): void => {
    if (newChildNode.parentNode) {
        removeChildNode(newChildNode.parentNode, newChildNode);
    }

    newChildNode.parentNode = node;

    const index = node.childNodes.indexOf(beforeChildNode);

    if (index === -1) {
        node.childNodes.push(newChildNode);

        if (newChildNode.yogaNode) {
            node.yogaNode?.insertChild(newChildNode.yogaNode, node.yogaNode.getChildCount());
        }
    } else {
        node.childNodes.splice(index, 0, newChildNode);

        if (newChildNode.yogaNode) {
            const yogaIndex = node.childNodes.slice(0, index).filter((childNode) => Boolean(childNode.yogaNode)).length;
            node.yogaNode?.insertChild(newChildNode.yogaNode, yogaIndex);
        }
    }

    if (node.nodeName === "ink-text" || node.nodeName === "ink-virtual-text") {
        markNodeAsDirty(node);
    }
};

export const removeChildNode = (node: DOMElement, removeNode: DOMNode): void => {
    if (removeNode.yogaNode) {
        removeNode.parentNode?.yogaNode?.removeChild(removeNode.yogaNode);
    }

    removeNode.parentNode = undefined;

    const index = node.childNodes.indexOf(removeNode);

    if (index !== -1) {
        node.childNodes.splice(index, 1);
    }

    if (node.nodeName === "ink-text" || node.nodeName === "ink-virtual-text") {
        markNodeAsDirty(node);
    }
};

export const setAttribute = (node: DOMElement, key: string, value: DOMNodeAttribute): void => {
    if (key === "internal_accessibility") {
        node.internal_accessibility = value as DOMElement["internal_accessibility"];

        return;
    }

    node.attributes[key] = value;
};

export const setStyle = (node: DOMNode, style?: Styles): void => {
    // Rendering code assumes style is always an object.
    node.style = style ?? {};
};

export const createTextNode = (text: string): TextNode => {
    const node: TextNode = {
        nodeName: "#text",
        nodeValue: text,
        parentNode: undefined,
        style: {},
        yogaNode: undefined,
    };

    setTextNodeValue(node, text);

    return node;
};

const measureTextNode = function (node: DOMNode, width: number): { height: number; width: number } {
    const text = node.nodeName === "#text" ? node.nodeValue : squashTextNodes(node);

    const dimensions = measureText(text);

    // Text fits into container, no need to wrap
    if (dimensions.width <= width) {
        return dimensions;
    }

    // This is happening when <Box> is shrinking child nodes and Yoga asks
    // if we can fit this text node in a <1px space, so we just tell Yoga "no"
    if (dimensions.width >= 1 && width > 0 && width < 1) {
        return dimensions;
    }

    const textWrap = node.style?.textWrap ?? "wrap";
    const wrappedText = wrapText(text, width, textWrap);

    return measureText(wrappedText);
};

const findClosestYogaNode = (node?: DOMNode): YogaNode | undefined => {
    if (!node?.parentNode) {
        return undefined;
    }

    return node.yogaNode ?? findClosestYogaNode(node.parentNode);
};

const markNodeAsDirty = (node?: DOMNode): void => {
    // Mark closest Yoga node as dirty to measure text dimensions again
    const yogaNode = findClosestYogaNode(node);

    yogaNode?.markDirty();
};

export const setTextNodeValue = (node: TextNode, text: string): void => {
    if (typeof text !== "string") {
        text = String(text);
    }

    node.nodeValue = text;
    markNodeAsDirty(node);
};

export const addLayoutListener = (rootNode: DOMElement, listener: LayoutListener): () => void => {
    if (rootNode.nodeName !== "ink-root") {
        return () => {};
    }

    rootNode.internal_layoutListeners ??= new Set();
    rootNode.internal_layoutListeners.add(listener);

    return () => {
        rootNode.internal_layoutListeners?.delete(listener);
    };
};

export const emitLayoutListeners = (rootNode: DOMElement): void => {
    if (rootNode.nodeName !== "ink-root" || !rootNode.internal_layoutListeners) {
        return;
    }

    for (const listener of rootNode.internal_layoutListeners) {
        listener();
    }
};
