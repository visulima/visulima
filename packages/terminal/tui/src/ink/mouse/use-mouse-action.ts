/**
 * Ported from `\@zenobius/ink-mouse` (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

import { useEffect, useState } from "react";

import type { MouseClickAction, MouseDragAction, MouseScrollAction } from "./mouse-context";
import useMouseContext from "./use-mouse";

const useMouseAction = (): MouseClickAction | MouseDragAction | MouseScrollAction | null => {
    const mouse = useMouseContext();
    // eslint-disable-next-line unicorn/no-null
    const [action, setAction] = useState<MouseClickAction | MouseDragAction | MouseScrollAction | null>(null);

    useEffect(() => {
        const onClickHandler = (_position: unknown, clickAction: MouseClickAction): void => {
            setAction(clickAction);
        };

        const onScrollHandler = (_position: unknown, scrollAction: MouseScrollAction): void => {
            setAction(scrollAction);
        };

        const onDragHandler = (_position: unknown, dragAction: MouseDragAction): void => {
            setAction(dragAction);
        };

        mouse.events.on("click", onClickHandler);
        mouse.events.on("scroll", onScrollHandler);
        mouse.events.on("drag", onDragHandler);

        return () => {
            mouse.events.off("click", onClickHandler);
            mouse.events.off("scroll", onScrollHandler);
            mouse.events.off("drag", onDragHandler);
        };
    }, [mouse.events]);

    return action;
};

export default useMouseAction;
