/**
 * StaticRender component — pre-renders children once and caches the result.
 *
 * When mounted, StaticRender renders its children into a Region via
 * prepareYogaTree() in the Ink layout phase, then caches the result on the
 * DOM node. On subsequent renders, the cached Region is composited directly
 * via addRegionTree(), skipping the entire subtree traversal.
 *
 * Children are passed as a render function `() => ReactNode`. Once the cache
 * is ready, the component stops calling the function so React does not
 * re-reconcile the subtree on subsequent renders.
 *
 * Use this for content that renders once and doesn't change (e.g., completed
 * task output, logged messages, static headers).
 *
 * Ported from jacob314/ink (Google LLC, Apache-2.0).
 * @license Apache-2.0
 */

import type { ReactNode } from "react";
import React, { useCallback, useEffect, useMemo, useRef } from "react";

import type { DOMElement } from "../dom";
import type { Styles } from "../styles";

export type Props = {
    readonly children: () => ReactNode;
    readonly style?: Styles;
    readonly width?: number;
};

const StaticRender = ({ children, style, width }: Props): React.ReactNode => {
    const nodeRef = useRef<DOMElement | null>(null);
    // Track rendered state in a ref to avoid triggering React state updates
    // during the commit phase (prepareYogaTree calls internal_onRendered
    // synchronously during layout, which would cause a "nested component
    // updates from render" warning with useState/useReducer).
    const isRenderedRef = useRef(false);

    const refCallback = useCallback((node: DOMElement | null) => {
        nodeRef.current = node;

        if (node) {
            node.internal_onRendered = () => {
                isRenderedRef.current = true;
            };
        }
    }, []);

    useEffect(() => {
        return () => {
            const node = nodeRef.current;

            if (node) {
                node.cachedRender = undefined;
                node.internal_onRendered = undefined;
            }
        };
    }, []);

    const mergedStyle = useMemo(() => {
        return {
            ...style,
            width,
        };
    }, [style, width]);

    return (
        <ink-static-render ref={refCallback} style={mergedStyle}>
            {isRenderedRef.current ? null : children()}
        </ink-static-render>
    );
};

export default StaticRender;
