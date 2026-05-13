import { getStringWidth, indent as indentString, isFullwidthCodePoint } from "@visulima/string";
import Yoga from "yoga-layout";

import type { DOMElement, DOMNode } from "./dom";
import getMaxWidth from "./get-max-width";
import { getAbsoluteContentPosition } from "./layout";
import { calculateScrollbarLayout } from "./measure-element";
import Output from "./output";
import type { Region } from "./region";
import renderBackground from "./render-background";
import renderBorder from "./render-border";
import { renderScrollbar } from "./render-scrollbar";
import { getStickyDescendants, identifyActiveStickyNodes, renderActiveStickyNodes } from "./render-sticky";
import { getScrollTop } from "./scroll";
import squashTextNodes from "./squash-text-nodes";
import wrapText from "./wrap-text";

// If parent container is `<Box>`, text nodes will be treated as separate nodes in
// the tree and will have their own coordinates in the layout.
// To ensure text nodes are aligned correctly, take X and Y of the first text node
// and use it as offset for the rest of the nodes
// Only first node is taken into account, because other text nodes can't have margin or padding,
// so their coordinates will be relative to the first node anyway
const applyPaddingToText = (node: DOMElement, text: string): string => {
    const yogaNode = node.childNodes[0]?.yogaNode;

    if (yogaNode) {
        const offsetX = Math.round(yogaNode.getComputedLeft());
        const offsetY = Math.round(yogaNode.getComputedTop());

        text = "\n".repeat(offsetY) + indentString(text, offsetX);
    }

    return text;
};

const c0ControlUpperBound = 0x1f;
const deleteCodePoint = 0x7f;
const c1ControlStart = 0x80;
const c1ControlEnd = 0x9f;

const mightExceedWidth = (text: string, maxWidth: number): boolean => {
    if (!Number.isFinite(maxWidth)) {
        return false;
    }

    if (maxWidth < 0) {
        return true;
    }

    let lineCodePointCount = 0;

    for (const character of text) {
        if (character === "\n") {
            if (lineCodePointCount > maxWidth) {
                return true;
            }

            lineCodePointCount = 0;
            continue;
        }

        const codePoint = character.codePointAt(0)!;

        if (codePoint <= c0ControlUpperBound || codePoint === deleteCodePoint || (codePoint >= c1ControlStart && codePoint <= c1ControlEnd)) {
            return true;
        }

        if (isFullwidthCodePoint(codePoint)) {
            return true;
        }

        lineCodePointCount++;

        if (lineCodePointCount > maxWidth) {
            return true;
        }
    }

    return false;
};

const isNodeHidden = (node: DOMElement): boolean => (node.internal_hidden ?? false) || node.yogaNode?.getDisplay() === Yoga.DISPLAY_NONE;

const isNodeOrAncestorHidden = (node: DOMElement): boolean => {
    let currentNode: DOMElement | undefined = node;

    while (currentNode) {
        if (isNodeHidden(currentNode)) {
            return true;
        }

        currentNode = currentNode.parentNode;
    }

    return false;
};

export type OutputTransformer = (s: string, index: number) => string;

export type CursorOutputPosition = {
    x: number;
    y: number;
};

export type RenderState = {
    cursorPosition: CursorOutputPosition | undefined;
    cursorRequested: boolean;
    lastTextWriteEnd?: CursorOutputPosition;
};

export const renderNodeToScreenReaderOutput = (
    node: DOMElement,
    options: {
        parentRole?: string;
        skipStaticElements?: boolean;
    } = {},
): string => {
    if (options.skipStaticElements && node.internal_static) {
        return "";
    }

    if (node.internal_hidden) {
        return "";
    }

    // Sticky alternate nodes are invisible duplicates for sticky header rendering;
    // they should not appear in screen reader output
    if (node.internal_stickyAlternate) {
        return "";
    }

    if (node.yogaNode?.getDisplay() === Yoga.DISPLAY_NONE) {
        return "";
    }

    let output = "";

    if (node.nodeName === "ink-text") {
        output = squashTextNodes(node);
    } else if (node.nodeName === "ink-box" || node.nodeName === "ink-root") {
        const separator = node.style.flexDirection === "row" || node.style.flexDirection === "row-reverse" ? " " : "\n";

        const childNodes
            = node.style.flexDirection === "row-reverse" || node.style.flexDirection === "column-reverse" ? node.childNodes.toReversed() : [...node.childNodes];

        output = childNodes
            .map((childNode) => {
                const screenReaderOutput = renderNodeToScreenReaderOutput(childNode as DOMElement, {
                    parentRole: node.internal_accessibility?.role,
                    skipStaticElements: options.skipStaticElements,
                });

                return screenReaderOutput;
            })
            .filter(Boolean)
            .join(separator);
    }

    if (node.internal_accessibility) {
        const { role, state } = node.internal_accessibility;

        if (state) {
            const stateKeys = Object.keys(state) as (keyof typeof state)[];
            const stateDescription = stateKeys.filter((key) => state[key]).join(", ");

            if (stateDescription) {
                output = `(${stateDescription}) ${output}`;
            }
        }

        if (role && role !== options.parentRole) {
            output = `${role}: ${output}`;
        }
    }

    return output;
};

// After nodes are laid out, render each to output object, which later gets rendered to terminal
const renderNodeToOutput = (
    node: DOMElement,
    output: Output,
    options: {
        absoluteOffsetX?: number;
        absoluteOffsetY?: number;
        offsetX?: number;
        offsetY?: number;
        renderState?: RenderState;
        selectionMap?: Map<DOMNode, { end: number; start: number }>;
        skipStaticElements: boolean;
        transformers?: OutputTransformer[];
    },
): void => {
    const { absoluteOffsetX, absoluteOffsetY, offsetX = 0, offsetY = 0, renderState, selectionMap, skipStaticElements, transformers = [] } = options;

    if (skipStaticElements && node.internal_static) {
        return;
    }

    if (node.internal_hidden) {
        return;
    }

    // Render caching: if this node has a cached render result (a Region),
    // composite it directly and skip the entire subtree traversal.
    if (node.cachedRender) {
        const x = Math.round(offsetX + (node.yogaNode?.getComputedLeft() ?? 0));
        const y = Math.round(offsetY + (node.yogaNode?.getComputedTop() ?? 0));

        output.addRegionTree(node.cachedRender, x, y);

        return;
    }

    if (node.nodeName === "ink-cursor") {
        if (!renderState) {
            return;
        }

        renderState.cursorRequested = true;

        const marker = node.internal_cursor;

        if (!marker) {
            renderState.cursorPosition = undefined;

            return;
        }

        // Inline mode: position cursor where the preceding text ended
        if (marker.inline) {
            if (renderState.lastTextWriteEnd) {
                renderState.cursorPosition = {
                    x: renderState.lastTextWriteEnd.x,
                    y: renderState.lastTextWriteEnd.y,
                };
            } else {
                // No preceding text — fall back to parent's content origin
                const parentPosition = node.parentNode ? getAbsoluteContentPosition(node.parentNode) : undefined;

                renderState.cursorPosition = parentPosition ? { x: parentPosition.x, y: parentPosition.y } : undefined;
            }

            return;
        }

        const resolvedAnchorNode = marker.anchorRef ? marker.anchorRef.current : node.parentNode;

        if (!resolvedAnchorNode) {
            renderState.cursorPosition = undefined;

            return;
        }

        if (marker.anchorRef && isNodeOrAncestorHidden(resolvedAnchorNode)) {
            renderState.cursorPosition = undefined;

            return;
        }

        const anchorPosition = getAbsoluteContentPosition(resolvedAnchorNode);

        if (!anchorPosition) {
            renderState.cursorPosition = undefined;

            return;
        }

        renderState.cursorPosition = {
            x: anchorPosition.x + marker.x,
            y: anchorPosition.y + marker.y,
        };

        return;
    }

    const { yogaNode } = node;

    if (yogaNode) {
        if (yogaNode.getDisplay() === Yoga.DISPLAY_NONE) {
            return;
        }

        // Left and top positions in Yoga are relative to their parent node
        const computedLeft = yogaNode.getComputedLeft();
        const computedTop = yogaNode.getComputedTop();
        const x = Math.round(offsetX + computedLeft);
        const y = Math.round(offsetY + computedTop);

        // Absolute offsets track the true screen position (for correct nested clip calculation)
        const absX = Math.round((absoluteOffsetX ?? offsetX) + computedLeft);
        const absY = Math.round((absoluteOffsetY ?? offsetY) + computedTop);

        // Visibility optimization: skip rendering nodes entirely outside the clip region
        const currentClip = output.getCurrentClip();

        if (currentClip) {
            const nodeWidth = Math.round(yogaNode.getComputedWidth());
            const nodeHeight = Math.round(yogaNode.getComputedHeight());

            const nodeRight = absX + nodeWidth;
            const nodeBottom = absY + nodeHeight;

            const clipLeft = currentClip.x1 ?? -Infinity;
            const clipRight = currentClip.x2 ?? Infinity;
            const clipTop = currentClip.y1 ?? -Infinity;
            const clipBottom = currentClip.y2 ?? Infinity;

            if (nodeRight <= clipLeft || absX >= clipRight || nodeBottom <= clipTop || absY >= clipBottom) {
                return;
            }
        }

        // Transformers are functions that transform final text output of each component
        // See Output class for logic that applies transformers
        let newTransformers = transformers;

        if (typeof node.internal_transform === "function") {
            newTransformers = [node.internal_transform, ...transformers];
        }

        if (node.nodeName === "ink-text") {
            let text = squashTextNodes(node);

            if (text.length > 0) {
                const maxWidth = getMaxWidth(yogaNode);

                if (mightExceedWidth(text, maxWidth)) {
                    const currentWidth = Math.max(...text.split("\n").map((line) => getStringWidth(line)));

                    if (currentWidth > maxWidth) {
                        const textWrap = node.style.textWrap ?? "wrap";

                        text = wrapText(text, Math.floor(maxWidth), textWrap);
                    }
                }

                text = applyPaddingToText(node, text);

                output.write(x, y, text, { transformers: newTransformers });

                // Track where this text ends for inline cursor positioning
                if (renderState) {
                    const lines = text.split("\n");
                    const lastLine = lines.at(-1) ?? "";

                    renderState.lastTextWriteEnd = {
                        x: x + getStringWidth(lastLine),
                        y: y + lines.length - 1,
                    };
                }
            }

            return;
        }

        let clipped = false;
        let scrollOffsetX = 0;
        let scrollOffsetY = 0;

        if (node.nodeName === "ink-box") {
            renderBackground(x, y, node, output);
            renderBorder(x, y, node, output);

            const overflow = node.style.overflow ?? "visible";
            const overflowX = node.style.overflowX ?? overflow;
            const overflowY = node.style.overflowY ?? overflow;

            const clipHorizontally = overflowX === "hidden" || overflowX === "scroll";
            const clipVertically = overflowY === "hidden" || overflowY === "scroll";

            if (clipHorizontally || clipVertically) {
                // Only fetch border widths for the axes that need clipping
                const nodeW = Math.round(yogaNode.getComputedWidth());
                const nodeH = Math.round(yogaNode.getComputedHeight());

                const regionX = clipHorizontally ? x + yogaNode.getComputedBorder(Yoga.EDGE_LEFT) : x;
                const regionW = clipHorizontally ? nodeW - yogaNode.getComputedBorder(Yoga.EDGE_LEFT) - yogaNode.getComputedBorder(Yoga.EDGE_RIGHT) : nodeW;
                const regionY = clipVertically ? y + yogaNode.getComputedBorder(Yoga.EDGE_TOP) : y;
                const regionH = clipVertically ? nodeH - yogaNode.getComputedBorder(Yoga.EDGE_TOP) - yogaNode.getComputedBorder(Yoga.EDGE_BOTTOM) : nodeH;

                output.startChildRegion(regionX, regionY, Math.max(0, regionW), Math.max(0, regionH));
                clipped = true;

                // Apply scroll offsets for children
                if (overflowY === "scroll" && node.internal_scrollState) {
                    scrollOffsetY = -node.internal_scrollState.scrollTop;
                }

                if (overflowX === "scroll" && node.internal_scrollState) {
                    scrollOffsetX = -node.internal_scrollState.scrollLeft;
                }
            }
        }

        if (node.nodeName === "ink-root" || node.nodeName === "ink-box" || node.nodeName === "ink-static-render") {
            for (const childNode of node.childNodes) {
                renderNodeToOutput(childNode as DOMElement, output, {
                    absoluteOffsetX: absX + scrollOffsetX,
                    absoluteOffsetY: absY + scrollOffsetY,
                    offsetX: x + scrollOffsetX,
                    offsetY: y + scrollOffsetY,
                    renderState,
                    selectionMap,
                    skipStaticElements,
                    transformers: newTransformers,
                });
            }

            // Render sticky headers after content (so they appear on top of scrolled content)
            if (node.nodeName === "ink-box" && node.internal_scrollState) {
                const stickyNodes = getStickyDescendants(node);

                if (stickyNodes.length > 0) {
                    const currentScrollTop = getScrollTop(node);
                    const currentClientHeight = node.internal_scrollState.clientHeight;
                    const viewportBottom = currentScrollTop + currentClientHeight;

                    const activeStickyNodes = identifyActiveStickyNodes(stickyNodes, node, currentScrollTop, viewportBottom);

                    if (activeStickyNodes.length > 0) {
                        const createOutput = (options_: { height: number; width: number }) => new Output(options_);

                        renderActiveStickyNodes(activeStickyNodes, node, output, createOutput, {
                            newTransformers,
                            skipStaticElements,
                            x,
                            y,
                        });
                    }
                }
            }

            // Render scrollbars after content and sticky headers (so they appear on top)
            if (node.nodeName === "ink-box" && node.internal_scrollState) {
                const overflow = node.style.overflow ?? "visible";
                const overflowX = node.style.overflowX ?? overflow;
                const overflowY = node.style.overflowY ?? overflow;
                const borderLeft = yogaNode.getComputedBorder(Yoga.EDGE_LEFT);
                const borderRight = yogaNode.getComputedBorder(Yoga.EDGE_RIGHT);
                const borderTop = yogaNode.getComputedBorder(Yoga.EDGE_TOP);
                const borderBottom = yogaNode.getComputedBorder(Yoga.EDGE_BOTTOM);
                const innerWidth = Math.round(yogaNode.getComputedWidth() - borderLeft - borderRight);
                const innerHeight = Math.round(yogaNode.getComputedHeight() - borderTop - borderBottom);

                const { clientHeight, clientWidth, scrollHeight, scrollLeft, scrollTop, scrollWidth } = node.internal_scrollState;

                const isVerticalScrollable = overflowY === "scroll" && scrollHeight > clientHeight;
                const isHorizontalScrollable = overflowX === "scroll" && scrollWidth > clientWidth;

                // Respect scrollbar prop (defaults to true)
                const showScrollbar = node.internal_scrollbar !== false;

                if (isVerticalScrollable && showScrollbar) {
                    const verticalLayout = calculateScrollbarLayout({
                        axis: "vertical",
                        clientDimension: clientHeight,
                        hasOppositeScrollbar: false,
                        height: innerHeight,
                        marginBottom: 0,
                        marginRight: 0,
                        scrollDimension: scrollHeight,
                        scrollPosition: scrollTop,
                        width: innerWidth,
                        x: x + borderLeft,
                        y: y + borderTop,
                    });

                    if (verticalLayout) {
                        renderScrollbar({
                            axis: "vertical",
                            color: node.style.scrollbarThumbColor,
                            layout: verticalLayout,
                            output,
                        });
                    }
                }

                if (isHorizontalScrollable && showScrollbar) {
                    const horizontalLayout = calculateScrollbarLayout({
                        axis: "horizontal",
                        clientDimension: clientWidth,
                        hasOppositeScrollbar: isVerticalScrollable,
                        height: innerHeight,
                        marginBottom: 0,
                        marginRight: 0,
                        scrollDimension: scrollWidth,
                        scrollPosition: scrollLeft,
                        width: innerWidth,
                        x: x + borderLeft,
                        y: y + borderTop,
                    });

                    if (horizontalLayout) {
                        renderScrollbar({
                            axis: "horizontal",
                            color: node.style.scrollbarThumbColor,
                            layout: horizontalLayout,
                            output,
                        });
                    }
                }
            }

            if (clipped) {
                output.endChildRegion();
            }
        }
    }
};

export default renderNodeToOutput;

/**
 * Render a DOM subtree into a cached Region.
 * Used by StaticRender to pre-render content once and cache it.
 */
export const renderToStatic = (node: DOMElement, options?: { skipStaticElements?: boolean; trackSelection?: boolean }): void => {
    if (!node.yogaNode) {
        return;
    }

    const width = Math.round(node.yogaNode.getComputedWidth());
    const height = Math.round(node.yogaNode.getComputedHeight());

    if (width <= 0 || height <= 0) {
        return;
    }

    const { setCachedRender } = require("./dom") as typeof import("./dom");

    const staticOutput = new Output({
        height,
        width,
    });

    for (const childNode of node.childNodes) {
        renderNodeToOutput(childNode as DOMElement, staticOutput, {
            skipStaticElements: options?.skipStaticElements ?? false,
        });
    }

    // Create a Region from the rendered output for caching
    const region: Region = {
        children: [],
        cursorPosition: undefined,
        height,
        id: (node as DOMElement & { internalId?: string }).internalId ?? "static",
        isScrollable: false,
        lines: [...staticOutput.getRootLines()],
        selectableSpans: [],
        stickyHeaders: [],
        styledOutput: [...staticOutput.getRootLines()],
        width,
        x: 0,
        y: 0,
    };

    setCachedRender(node, region);
};
