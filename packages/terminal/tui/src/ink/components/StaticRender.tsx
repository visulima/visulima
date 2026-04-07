/**
 * StaticRender component — pre-renders children once and caches the result.
 *
 * When mounted, StaticRender renders its children into a Region on the first
 * render pass (via internalOnBeforeRender), then caches the result on the DOM
 * node. On subsequent renders, the cached Region is composited directly via
 * addRegionTree(), skipping the entire subtree traversal.
 *
 * Use this for content that renders once and doesn't change (e.g., completed
 * task output, logged messages, static headers).
 *
 * Ported from jacob314/ink (Google LLC, Apache-2.0).
 * @license Apache-2.0
 */

import type { ReactNode } from "react";
import React, { useEffect, useMemo, useRef } from "react";

import type { DOMElement } from "../dom";
import { renderToStatic } from "../render-node-to-output";
import type { Styles } from "../styles";

export type Props = {
    readonly children: ReactNode;
    readonly style?: Styles;
    readonly width?: number;
};

const handleBeforeRender = (node: DOMElement): void => {
    if (!node.cachedRender) {
        renderToStatic(node);
    }
};

const StaticRender = ({ children, style, width }: Props): React.ReactNode => {
    const ref = useRef<DOMElement>(null);

    useEffect(() => {
        const node = ref.current;

        return () => {
            if (node) {
                node.cachedRender = undefined;
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
        <ink-box
            internalOnBeforeRender={handleBeforeRender}
            ref={ref}
            style={mergedStyle}
        >
            {children}
        </ink-box>
    );
};

export default StaticRender;
