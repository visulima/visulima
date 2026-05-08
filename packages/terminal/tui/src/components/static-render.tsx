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
 * Re-rendering the cached content is controlled via the `deps` prop (similar
 * to React's hook deps). When `deps` changes, the cache is invalidated and
 * `children()` is invoked again. If `deps` is omitted, the cache is
 * invalidated whenever the `children` function reference changes.
 *
 * Use this for content that renders once and doesn't change (e.g., completed
 * task output, logged messages, static headers).
 *
 * Ported from jacob314/ink (Google LLC, Apache-2.0).
 * @license Apache-2.0
 */

import type { DependencyList, ReactNode } from "react";
import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import type { DOMElement } from "../ink/dom";
import type { Styles } from "../ink/styles";

/**
 * @property children Render function invoked once to produce the cached content.
 * @property deps Dependencies that control when the static content is re-rendered. When any dependency changes (shallow, Object.is comparison), the cache is invalidated and children() is invoked again. If omitted, the cache is invalidated whenever the children function reference changes.
 * @property style Optional style applied to the static-render container.
 * @property width Optional fixed width for the cached region.
 */
export type Props = {
    readonly children: () => ReactNode;
    readonly deps?: DependencyList;
    readonly style?: Styles;
    readonly width?: number;
};

const areDepsEqual = (previousDeps: DependencyList | undefined, nextDeps: DependencyList | undefined): boolean => {
    if (previousDeps === nextDeps) {
        return true;
    }

    if (!previousDeps || !nextDeps) {
        return false;
    }

    if (previousDeps.length !== nextDeps.length) {
        return false;
    }

    for (const [index, previousDep] of previousDeps.entries()) {
        if (!Object.is(previousDep, nextDeps[index])) {
            return false;
        }
    }

    return true;
};

const StaticRender = ({ children, deps, style, width }: Props): React.ReactNode => {
    const ref = useRef<DOMElement>(null);
    // Track rendered state in a ref to avoid triggering React state updates
    // during the commit phase (prepareYogaTree calls internal_onRendered
    // synchronously during layout).
    const isRenderedRef = useRef(false);
    const previousDepsRef = useRef(deps);
    const previousChildrenRef = useRef(children);

    // Detect content change during render and invalidate the cache.
    // Clearing the node's cachedRender is an in-place mutation (not a React
    // state change), so it's safe to do during render — the next layout pass
    // (prepareYogaTree) sees `!cachedRender` and re-runs renderToStatic.
    let invalidated = false;

    if (deps !== undefined) {
        if (!areDepsEqual(previousDepsRef.current, deps)) {
            invalidated = true;
            previousDepsRef.current = deps;
        }
    } else if (children !== previousChildrenRef.current) {
        invalidated = true;
        previousChildrenRef.current = children;
    }

    if (invalidated) {
        isRenderedRef.current = false;

        if (ref.current) {
            ref.current.cachedRender = undefined;
        }
    }

    // useLayoutEffect fires synchronously during commit, before paint — this
    // ensures internal_onRendered is attached before prepareYogaTree runs in
    // the live rendering pipeline. In renderToString, useLayoutEffect also
    // fires synchronously so state updates it triggers are reflected.
    useLayoutEffect(() => {
        const node = ref.current;

        if (node) {
            node.internal_onRendered = () => {
                isRenderedRef.current = true;
            };
        }
    });

    useEffect(
        () => () => {
            const node = ref.current;

            if (node) {
                node.cachedRender = undefined;
                node.internal_onRendered = undefined;
            }
        },
        [],
    );

    const mergedStyle = useMemo(() => {
        return {
            ...style,
            width,
        };
    }, [style, width]);

    return (
        <ink-static-render ref={ref} style={mergedStyle}>
            {isRenderedRef.current ? null : children()}
        </ink-static-render>
    );
};

export default StaticRender;

export { StaticRender };
export type { Props as StaticRenderProps };
