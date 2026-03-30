/**
 * Ported from @zenobius/ink-mouse (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

import { useCallback, useEffect, type RefObject } from "react";

import type { DOMElement } from "../dom";
import type { MouseButton, MouseClickAction, MousePosition } from "./mouse-context";
import { isIntersecting } from "./is-intersecting";
import { getElementDimensions, getElementPosition } from "./use-element-position";
import { useMouseContext } from "./use-mouse";

type UseOnMouseClickOptions = {
    /** Filter to only respond to a specific mouse button. Defaults to all buttons. */
    button?: MouseButton;
};

function useOnMouseClick(
    ref: RefObject<DOMElement | null>,
    onChange: (clicking: boolean, button?: MouseButton) => void,
    options?: UseOnMouseClickOptions,
): void {
    const mouse = useMouseContext();

    const handler = useCallback(
        (position: MousePosition, action: MouseClickAction, eventButton?: MouseButton) => {
            if (options?.button && eventButton !== options.button) {
                return;
            }

            const elementPosition = getElementPosition(ref.current);
            const elementDimensions = getElementDimensions(ref.current);

            if (!elementPosition || !elementDimensions) {
                return;
            }

            const element = {
                ...elementPosition,
                ...elementDimensions,
            };

            onChange(isIntersecting({ element, mouse: position }) && action === "press", eventButton);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ref, onChange, options?.button],
    );

    useEffect(
        function handleIntersection() {
            const events = mouse.events;

            events.on("click", handler);

            return () => {
                events.off("click", handler);
            };
        },
        [mouse.events, handler],
    );
}

export { useOnMouseClick };
export type { UseOnMouseClickOptions };
