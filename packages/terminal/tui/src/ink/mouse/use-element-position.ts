/**
 * Ported from @zenobius/ink-mouse (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

import { useEffect, useState, type RefObject } from "react";

import type { DOMElement } from "../dom";

/**
 * Walks the node's ancestry to calculate its absolute position.
 *
 * Terminal coordinates are 1-indexed, so initial left and top values start at 1.
 * Since Ink nodes are relative by default and Ink does not provide precomputed
 * absolute x/y values, we walk the parent chain and accumulate layout offsets.
 */
function walkNodePosition(node: DOMElement): { left: number; top: number } {
    let current: DOMElement | undefined = node;
    let left = 1;
    let top = 1;

    while (current) {
        if (!current.yogaNode) {
            return { left, top };
        }

        const layout = current.yogaNode.getComputedLayout();

        left += layout.left;
        top += layout.top;

        current = current.parentNode;
    }

    return { left, top };
}

function getElementPosition(node: DOMElement | null): { left: number; top: number } | undefined {
    if (!node) {
        return;
    }

    return walkNodePosition(node);
}

function getElementDimensions(node: DOMElement | null): { height: number; width: number } | undefined {
    const elementLayout = node?.yogaNode?.getComputedLayout();

    if (!elementLayout) {
        return;
    }

    return {
        height: elementLayout.height,
        width: elementLayout.width,
    };
}

/**
 * Stateful hook to provide the absolute position of the referenced element.
 */
function useElementPosition(
    ref: RefObject<DOMElement | null>,
    deps: unknown[] = [],
): { left: number; top: number } {
    const [position, setPosition] = useState<{ left: number; top: number }>({
        left: 0,
        top: 0,
    });

    useEffect(
        function updatePosition() {
            const pos = getElementPosition(ref.current);

            if (!pos) {
                return;
            }

            setPosition(pos);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        deps,
    );

    return position;
}

/**
 * Stateful hook to provide the dimensions of the referenced element.
 */
function useElementDimensions(
    ref: RefObject<DOMElement | null>,
    deps: unknown[] = [],
): { height: number; width: number } {
    const [dimensions, setDimensions] = useState<{ height: number; width: number }>({
        height: 0,
        width: 0,
    });

    useEffect(
        function updateDimensions() {
            const dims = getElementDimensions(ref.current);

            if (!dims) {
                return;
            }

            setDimensions(dims);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        deps,
    );

    return dimensions;
}

export { getElementDimensions, getElementPosition, useElementDimensions, useElementPosition };
