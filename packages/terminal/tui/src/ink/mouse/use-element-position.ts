/**
 * Ported from `\@zenobius/ink-mouse` (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

import type { RefObject } from "react";
import { useEffect, useState } from "react";

import type { DOMElement } from "../dom";

/**
 * Walks the node's ancestry to calculate its absolute position.
 *
 * Terminal coordinates are 1-indexed, so initial left and top values start at 1.
 * Since Ink nodes are relative by default and Ink does not provide precomputed
 * absolute x/y values, we walk the parent chain and accumulate layout offsets.
 */
const walkNodePosition = (node: DOMElement): { left: number; top: number } => {
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
};

const getElementPosition = (node: DOMElement | null): { left: number; top: number } | undefined => {
    if (!node) {
        return undefined;
    }

    return walkNodePosition(node);
};

const getElementDimensions = (node: DOMElement | null): { height: number; width: number } | undefined => {
    const elementLayout = node?.yogaNode?.getComputedLayout();

    if (!elementLayout) {
        return undefined;
    }

    return {
        height: elementLayout.height,
        width: elementLayout.width,
    };
};

/**
 * Stateful hook to provide the absolute position of the referenced element.
 */
const useElementPosition = (ref: RefObject<DOMElement | null>, deps: unknown[] = []): { left: number; top: number } => {
    const [position, setPosition] = useState({
        left: 0,
        top: 0,
    });

    useEffect(
        () => {
            const pos = getElementPosition(ref.current);

            if (pos) {
                setPosition(pos);
            }
        },

        deps,
    );

    return position;
};

/**
 * Stateful hook to provide the dimensions of the referenced element.
 */
const useElementDimensions = (ref: RefObject<DOMElement | null>, deps: unknown[] = []): { height: number; width: number } => {
    const [dimensions, setDimensions] = useState({
        height: 0,
        width: 0,
    });

    useEffect(
        () => {
            const dims = getElementDimensions(ref.current);

            if (dims) {
                setDimensions(dims);
            }
        },

        deps,
    );

    return dimensions;
};

export { getElementDimensions, getElementPosition, useElementDimensions, useElementPosition };
