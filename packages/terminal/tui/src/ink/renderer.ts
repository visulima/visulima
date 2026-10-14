/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import Yoga from "yoga-layout";

import type { CursorShape } from "./cursor-helpers";
import type { DOMElement, DOMNode } from "./dom";
import { isNodeSelectable } from "./dom";
import type { CursorPosition } from "./log-update";
import Output, { OutputCaches } from "./output";
import type { RenderState } from "./render-node-to-output";
import renderNodeToOutput, { renderNodeToScreenReaderOutput } from "./render-node-to-output";
import type { Selection } from "./selection";

type Result = {
    cursorPosition: CursorPosition | undefined;
    cursorRequested: boolean;
    cursorShape: CursorShape | undefined;
    output: string;
    outputBuffer?: Uint32Array;
    outputHeight: number;
    outputWidth?: number;
    staticOutput: string;
};

/**
 * Build a map of DOM nodes to their selected character ranges.
 * Used to apply selection highlighting during rendering.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
const calculateSelectionMap = (root: DOMElement, selection: Selection): Map<DOMNode, { end: number; start: number }> => {
    const map = new Map<DOMNode, { end: number; start: number }>();

    if (selection.rangeCount === 0) {
        return map;
    }

    const range = selection.getRangeAt(0);
    const { endContainer, endOffset, startContainer, startOffset } = range;

    if (!startContainer || !endContainer) {
        return map;
    }

    let hasFoundStart = false;
    let hasFoundEnd = false;

    const visitChildren = (
        node: DOMNode,
        localLengthRef: { value: number },
        startRef: { value: number },
        endRef: { value: number },
        startFoundRef: { value: boolean },
        endFoundRef: { value: boolean },
    ): void => {
        if (node.nodeName === "#text") {
            const { length } = node.nodeValue;

            if (startContainer === node) {
                startFoundRef.value = true;
                startRef.value = localLengthRef.value + startOffset;
            }

            if (endContainer === node) {
                endFoundRef.value = true;
                endRef.value = localLengthRef.value + endOffset;
            }

            localLengthRef.value += length;
        } else if ("childNodes" in node) {
            for (const child of node.childNodes) {
                if (node === startContainer) {
                    startFoundRef.value = true;
                    startRef.value = localLengthRef.value;
                }

                if (node === endContainer) {
                    endFoundRef.value = true;
                    endRef.value = localLengthRef.value;
                }

                visitChildren(child, localLengthRef, startRef, endRef, startFoundRef, endFoundRef);
            }

            if (node === startContainer && startOffset === node.childNodes.length) {
                startFoundRef.value = true;
                startRef.value = localLengthRef.value;
            }

            if (node === endContainer && endOffset === node.childNodes.length) {
                endFoundRef.value = true;
                endRef.value = localLengthRef.value;
            }
        }
    };

    const visit = (node: DOMNode): void => {
        if (node.nodeName === "ink-text") {
            if (!isNodeSelectable(node)) {
                return;
            }

            const localLengthRef = { value: 0 };
            const nodeStartRef = { value: -1 };
            const nodeEndRef = { value: -1 };
            const foundStartRef = { value: false };
            const foundEndRef = { value: false };

            for (const child of node.childNodes) {
                if (node === startContainer) {
                    foundStartRef.value = true;
                    nodeStartRef.value = localLengthRef.value;
                }

                if (node === endContainer) {
                    foundEndRef.value = true;
                    nodeEndRef.value = localLengthRef.value;
                }

                visitChildren(child, localLengthRef, nodeStartRef, nodeEndRef, foundStartRef, foundEndRef);
            }

            if (node === startContainer && startOffset === node.childNodes.length) {
                foundStartRef.value = true;
                nodeStartRef.value = localLengthRef.value;
            }

            if (node === endContainer && endOffset === node.childNodes.length) {
                foundEndRef.value = true;
                nodeEndRef.value = localLengthRef.value;
            }

            if ((hasFoundStart || foundStartRef.value) && (!hasFoundEnd || foundEndRef.value)) {
                const start = foundStartRef.value ? nodeStartRef.value : 0;
                const end = foundEndRef.value ? nodeEndRef.value : localLengthRef.value;

                if (start !== -1 && end !== -1 && start < end) {
                    map.set(node, { end, start });
                }
            }

            if (foundStartRef.value) {
                hasFoundStart = true;
            }

            if (foundEndRef.value) {
                hasFoundEnd = true;
            }
        } else {
            const { childNodes } = node as DOMElement;

            if (childNodes) {
                for (const child of childNodes) {
                    if (node === startContainer) {
                        hasFoundStart = true;
                    }

                    if (node === endContainer) {
                        hasFoundEnd = true;
                    }

                    visit(child);
                }

                if (node === startContainer && startOffset === childNodes.length) {
                    hasFoundStart = true;
                }

                if (node === endContainer && endOffset === childNodes.length) {
                    hasFoundEnd = true;
                }
            }
        }
    };

    visit(root);

    return map;
};

const interactiveOutputCaches = new OutputCaches();
const staticOutputCaches = new OutputCaches();
const interactiveOutputs = new WeakMap<DOMElement, Output>();
const staticOutputs = new WeakMap<DOMElement, Output>();

type ReusableOutputOptions = {
    caches: OutputCaches;
    height: number;
    node: DOMElement;
    outputs: WeakMap<DOMElement, Output>;
    width: number;
};

const getReusableOutput = ({ caches, height, node, outputs, width }: ReusableOutputOptions): Output => {
    let output = outputs.get(node);

    if (!output) {
        output = new Output({
            caches,
            height,
            width,
        });
        outputs.set(node, output);
    }

    output.reset(width, height);

    return output;
};

// Static output is only written on the render that mounted its children; afterwards the <Static> box
// keeps just its padding, which must not be written again. While the children are mounted, every row
// is written, blank ones included, so a row that renders empty still takes up its line.
const getVisibleStaticNode = (staticNode: DOMElement | undefined): DOMElement | undefined => {
    for (let ancestor: DOMElement | undefined = staticNode; ancestor; ancestor = ancestor.parentNode) {
        if (ancestor.yogaNode?.getDisplay() === Yoga.DISPLAY_NONE) {
            return undefined;
        }
    }

    return staticNode;
};

const serializeStaticOutput = (staticNode: DOMElement | undefined, staticOutput: Output | undefined): string => {
    if (!staticNode || !staticOutput || staticNode.childNodes.length === 0) {
        return "";
    }

    const { height, output } = staticOutput.get();

    return height > 0 ? `${output}\n` : "";
};

const renderer = (
    node: DOMElement,
    isScreenReaderEnabled: boolean,
    options?: {
        selection?: Selection;
        useNativeRenderer?: boolean;
    },
): Result => {
    if (node.yogaNode) {
        if (isScreenReaderEnabled) {
            const output = renderNodeToScreenReaderOutput(node, {
                skipStaticElements: true,
            });

            const outputHeight = output === "" ? 0 : output.split("\n").length;

            let staticOutput = "";

            // Static output is rendered from its own subtree, so a hidden ancestor must be checked explicitly.
            const staticNode = getVisibleStaticNode(node.staticNode);

            if (staticNode) {
                staticOutput = renderNodeToScreenReaderOutput(staticNode, {
                    skipStaticElements: false,
                });
            }

            return {
                cursorPosition: undefined,
                cursorRequested: false,
                cursorShape: undefined,
                output,
                outputHeight,
                staticOutput: staticOutput ? `${staticOutput}\n` : "",
            };
        }

        // Build selection map if a selection is active
        const selectionMap = options?.selection && options.selection.rangeCount > 0 ? calculateSelectionMap(node, options.selection) : undefined;

        const output = getReusableOutput({
            caches: interactiveOutputCaches,
            height: node.yogaNode.getComputedHeight(),
            node,
            outputs: interactiveOutputs,
            width: node.yogaNode.getComputedWidth(),
        });

        const renderState: RenderState = {
            cursorPosition: undefined,
            cursorRequested: false,
            cursorShape: undefined,
        };

        renderNodeToOutput(node, output, {
            renderState,
            selectionMap,
            skipStaticElements: true,
        });

        let staticOutput;

        if (node.staticNode?.yogaNode) {
            staticOutput = getReusableOutput({
                caches: staticOutputCaches,
                // Include the offset and margins, or static rows that start below the top or end inside a margin get clipped.
                height:
                    node.staticNode.yogaNode.getComputedTop()
                    + node.staticNode.yogaNode.getComputedHeight()
                    + node.staticNode.yogaNode.getComputedMargin(Yoga.EDGE_BOTTOM),
                node,
                outputs: staticOutputs,
                width:
                    node.staticNode.yogaNode.getComputedLeft()
                    + node.staticNode.yogaNode.getComputedWidth()
                    + node.staticNode.yogaNode.getComputedMargin(Yoga.EDGE_RIGHT),
            });

            renderNodeToOutput(node.staticNode, staticOutput, {
                skipStaticElements: false,
            });
        }

        // When native renderer is requested, produce a Uint32Array buffer
        // alongside the string output (string is still needed for static output)
        if (options?.useNativeRenderer) {
            const { buffer: outputBuffer, height: outputHeight } = output.getBuffer();

            return {
                cursorPosition: renderState.cursorPosition,
                cursorRequested: renderState.cursorRequested,
                cursorShape: renderState.cursorShape,
                output: "",
                outputBuffer,
                outputHeight,
                outputWidth: output.width,
                staticOutput: serializeStaticOutput(node.staticNode, staticOutput),
            };
        }

        const { height: outputHeight, output: generatedOutput } = output.get();

        return {
            cursorPosition: renderState.cursorPosition,
            cursorRequested: renderState.cursorRequested,
            cursorShape: renderState.cursorShape,
            output: generatedOutput,
            outputHeight,
            // Newline at the end is needed, because static output doesn't have one, so
            // interactive output will override last line of static output
            staticOutput: serializeStaticOutput(node.staticNode, staticOutput),
        };
    }

    return {
        cursorPosition: undefined,
        cursorRequested: false,
        cursorShape: undefined,
        output: "",
        outputHeight: 0,
        staticOutput: "",
    };
};

export default renderer;
