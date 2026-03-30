/**
 * Ported from @zenobius/ink-mouse (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

import { useCallback, useEffect, type RefObject } from "react";

import type { DOMElement } from "../dom";
import type { MousePosition } from "./mouse-context";
import { isIntersecting } from "./is-intersecting";
import { getElementDimensions, getElementPosition } from "./use-element-position";
import { useMouseContext } from "./use-mouse";

function useOnMouseHover(ref: RefObject<DOMElement | null>, onChange: (event: boolean) => void): void {
    const mouse = useMouseContext();

    const handler = useCallback(
        (position: MousePosition) => {
            const elementPosition = getElementPosition(ref.current);
            const elementDimensions = getElementDimensions(ref.current);

            if (!elementPosition || !elementDimensions) {
                return;
            }

            const element = {
                ...elementPosition,
                ...elementDimensions,
            };

            onChange(isIntersecting({ element, mouse: position }));
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ref, onChange],
    );

    useEffect(
        function handleIntersection() {
            const events = mouse.events;

            events.on("position", handler);

            return () => {
                events.off("position", handler);
            };
        },
        [mouse.events, handler],
    );
}

export { useOnMouseHover };
