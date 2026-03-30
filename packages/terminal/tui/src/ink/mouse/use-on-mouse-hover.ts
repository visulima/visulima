/**
 * Ported from `\@zenobius/ink-mouse` (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

import type { RefObject } from "react";
import { useCallback, useEffect } from "react";

import type { DOMElement } from "../dom";
import isIntersecting from "./is-intersecting";
import type { MousePosition } from "./mouse-context";
import { getElementDimensions, getElementPosition } from "./use-element-position";
import useMouseContext from "./use-mouse";

const useOnMouseHover = (ref: RefObject<DOMElement | null>, onChange: (event: boolean) => void): void => {
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

        [ref, onChange],
    );

    useEffect(() => {
        const { events } = mouse;

        events.on("position", handler);

        return () => {
            events.off("position", handler);
        };
    }, [mouse.events, handler]);
};

export default useOnMouseHover;
