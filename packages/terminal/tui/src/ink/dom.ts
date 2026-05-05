/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-use-before-define, unicorn/no-null, unicorn/prefer-dom-node-remove */
import type { Node as YogaNode } from "yoga-layout";
import Yoga from "yoga-layout";

import measureText from "./measure-text";
import type { Region } from "./region";
import type { OutputTransformer } from "./render-node-to-output";
import type ResizeObserver from "./resize-observer";
import type { ScrollState } from "./scroll";
import squashTextNodes from "./squash-text-nodes";
import type { StyledLine } from "./styled-line";
import type { Styles } from "./styles";
import wrapText from "./wrap-text";

type InkNode = {
    internal_static?: boolean;
    parentNode: DOMElement | undefined;
    style: Styles;
    yogaNode?: YogaNode;
};

type LayoutListener = () => void;

let idCounter = 0;

export type TextName = "#text";
export type ElementNames = "ink-root" | "ink-box" | "ink-text" | "ink-cursor" | "ink-virtual-text" | "ink-static-render";

/**
 * Describes a sticky header that should be composited on top of scrolled content.
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
export type StickyHeader = {
    /** Content-relative end row. */
    endRow: number;
    /** Height in rows. */
    height?: number;
    /** If true, natural 'lines' are already in background content. */
    isStuckOnly: boolean;
    /** Lines rendered in the natural (scrolling) position. */
    lines: ReadonlyArray<StyledLine>;
    /** Natural row offset relative to content start. */
    naturalRow: number;
    /** Reference to the DOM node for this header. */
    node?: DOMElement;
    /** Unique ID of the sticky node. */
    nodeId: number;
    /** ID of the scroll container this header belongs to. */
    scrollContainerId: number | string;
    /** Content-relative start row. */
    startRow: number;
    /** Lines rendered in the stuck (pinned) position, if different. */
    stuckLines?: ReadonlyArray<StyledLine>;
    /** Sticky type: top-pinned or bottom-pinned. */
    type?: "top" | "bottom";
    /** Stuck X position relative to region. */
    x: number;
    /** Stuck Y position relative to region. */
    y: number;
};

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

    /**
     * Cached render result (a Region). When set, the entire subtree is
     * skipped during rendering and the cached region is composited directly.
     * Set by setCachedRender(), cleared on unmount by cleanupNodeTree().
     */
    cachedRender?: Region;
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

    internal_cursor?: CursorMarker;

    internal_hidden?: boolean;

    /**
     * Auto-incrementing unique identifier for this node.
     */
    internal_id: number;

    /**
     * Whether this element's scrollback buffer is dirty (needs recalculation).
     */
    internal_isScrollbackDirty?: boolean;

    /**
     * Last measured size for ResizeObserver tracking.
     */
    internal_lastMeasuredSize?: { height: number; width: number };

    internal_layoutListeners?: Set<LayoutListener>;

    /**
     * Maximum scrollTop ever reached, used with stableScrollback.
     */
    internal_maxScrollTop?: number;

    /**
     * Callback invoked after prepareYogaTree() caches the render output for
     * an ink-static-render node. StaticRender uses this to set `isRendered`
     * state, which prevents React from re-reconciling children once cached.
     */
    internal_onRendered?: () => void;

    /**
     * Whether this element is opaque (prevents rendering of covered content beneath it).
     */
    internal_opaque?: boolean;

    /**
     * Whether the scrollbar should be rendered for this scrollable element.
     * Defaults to true for elements with overflow: 'scroll'.
     */
    internal_scrollbar?: boolean;

    /**
     * Scroll state computed by calculateScroll() for elements with overflow: 'scroll'.
     */
    internal_scrollState?: ScrollState;

    /**
     * Whether this element is sticky (pinned during scroll).
     * - `true` or `'top'`: pinned to the top of the scroll container
     * - `'bottom'`: pinned to the bottom of the scroll container
     */
    internal_sticky?: boolean | "top" | "bottom";

    /**
     * Whether this element is the alternate (stuck) version of a sticky header.
     * The stuck version is rendered when the header is pinned.
     */
    internal_stickyAlternate?: boolean;

    /**
     * Whether this element should receive the terminal cursor focus.
     */
    internal_terminalCursorFocus?: boolean;

    /**
     * Terminal cursor position offset within this element.
     */
    internal_terminalCursorPosition?: number;

    /**
     * Cached text squash result for this node's subtree.
     * Invalidated by markNodeAsDirty() when children change.
     */
    internal_textCache?: {
        map: Map<DOMNode, { end: number; start: number }>;
        text: string;
    };

    internal_transform?: OutputTransformer;

    // Internal properties
    isStaticDirty?: boolean;

    /**
     * Whether the Yoga subtree has been detached (children removed from Yoga layout)
     * because a cachedRender was set. When cachedRender is invalidated,
     * prepareYogaTree() re-attaches the children before the next layout pass.
     */
    isYogaTreeDetached?: boolean;

    nodeName: ElementNames;
    onComputeLayout?: () => void;
    onImmediateRender?: () => void;
    onRender?: () => void;

    /**
     * Set of ResizeObservers attached to this element.
     */
    resizeObservers?: Set<ResizeObserver>;

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
        internal_id: idCounter++,
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

// When structural changes happen on a subtree containing an already-rendered
// ink-static-render leaf, dirty its *parent* rather than the leaf so the cache
// is preserved. Otherwise dirty the node itself.
const markNodeAndParentIfStaticAsDirty = (node: DOMElement): void => {
    markNodeAsDirty(node.nodeName === "ink-static-render" && node.cachedRender ? node.parentNode : node);
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

    markNodeAndParentIfStaticAsDirty(node);
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

    markNodeAndParentIfStaticAsDirty(node);
};

export const removeChildNode = (node: DOMElement, removeNode: DOMNode): void => {
    if (removeNode.yogaNode) {
        // Use Yoga's internal parent reference (authoritative) rather than
        // the JS parentNode which can become stale.
        const parentYogaNode = removeNode.yogaNode.getParent();

        if (parentYogaNode) {
            parentYogaNode.removeChild(removeNode.yogaNode);
        }
    }

    removeNode.parentNode = undefined;

    const index = node.childNodes.indexOf(removeNode);

    if (index !== -1) {
        node.childNodes.splice(index, 1);
    }

    markNodeAndParentIfStaticAsDirty(node);
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

// Uses string-based measurement for Yoga layout (proven correct).
// The render path uses StyledLine-based wrapping in render-text-node.ts.
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
    const wrappedText = wrapText(text, Math.floor(width), textWrap);

    return measureText(wrappedText);
};

const findClosestYogaNode = (node?: DOMNode): YogaNode | undefined => {
    if (!node?.parentNode) {
        return undefined;
    }

    return node.yogaNode ?? findClosestYogaNode(node.parentNode);
};

export const markNodeAsDirty = (node?: DOMNode): void => {
    // Yoga measurement only needs re-running when text content changes
    // (non-text nodes derive dimensions from children via layout).
    if (node?.nodeName === "#text" || node?.nodeName === "ink-text" || node?.nodeName === "ink-virtual-text") {
        const yogaNode = findClosestYogaNode(node);

        yogaNode?.markDirty();
    }

    // Walk up the tree clearing caches that depend on this subtree.
    // Preserve an ancestor ink-static-render's cachedRender when walking
    // *through* it (i.e. it isn't the origin node) — structural changes
    // below a clean static-render leaf shouldn't blow its cache.
    let current = node;

    while (current) {
        if (current.nodeName === "ink-text" || current.nodeName === "ink-virtual-text") {
            current.internal_textCache = undefined;
        }

        if ("childNodes" in current) {
            const shouldPreserveStaticCache = current !== node && current.nodeName === "ink-static-render" && Boolean(current.cachedRender);

            if (shouldPreserveStaticCache) {
                break;
            }

            current.cachedRender = undefined;
        }

        current = current.parentNode;
    }
};

export const setTextNodeValue = (node: TextNode, text: string): void => {
    if (typeof text !== "string") {
        text = String(text);
    }

    node.nodeValue = text;
    markNodeAsDirty(node);
};

export const addLayoutListener = (rootNode: DOMElement, listener: LayoutListener): (() => void) => {
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

/**
 * Store a cached render result on a DOM node. Fixes the Yoga node
 * dimensions to match the cached region and removes all Yoga children
 * (since rendering is cached, child layout is no longer needed).
 *
 * Ported from jacob314/ink (Google LLC, Apache-2.0).
 */
export const setCachedRender = (node: DOMElement, cachedRender: Region): void => {
    node.cachedRender = cachedRender;

    if (node.yogaNode) {
        node.yogaNode.setWidth(cachedRender.width);
        node.yogaNode.setHeight(cachedRender.height);

        while (node.yogaNode.getChildCount() > 0) {
            node.yogaNode.removeChild(node.yogaNode.getChild(0));
        }

        node.isYogaTreeDetached = true;
    }
};

/**
 * Get the path from the root to this node (inclusive).
 * Returns an array starting with the root and ending with the node.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
export const getPathToRoot = (node: DOMNode): DOMNode[] => {
    const path: DOMNode[] = [];
    let current: DOMNode | undefined = node;

    while (current) {
        path.unshift(current);
        current = current.parentNode;
    }

    return path;
};

/**
 * Check if a node is selectable by walking up the tree checking `userSelect` style.
 * Returns true by default unless an ancestor has `userSelect: 'none'`.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
export const isNodeSelectable = (node: DOMElement): boolean => {
    let current: DOMElement | undefined = node;

    while (current) {
        const { userSelect } = current.style;

        if (userSelect === "none") {
            return false;
        }

        if (userSelect === "text" || userSelect === "all") {
            return true;
        }

        current = current.parentNode;
    }

    // Default: selectable
    return true;
};
