/**
 * Ported from `\@zenobius/ink-mouse` (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

import { useEffect, useState } from "react";

import type { MousePosition } from "./mouse-context";
import useMouseContext from "./use-mouse";

const useMousePosition = (): MousePosition => {
    const mouse = useMouseContext();
    const [position, setPosition] = useState({
        x: mouse.position.x,
        y: mouse.position.y,
    });

    useEffect(() => {
        const handler = (newPosition: MousePosition): void => {
            setPosition({
                x: newPosition.x,
                y: newPosition.y,
            });
        };

        mouse.events.on("position", handler);

        return () => {
            mouse.events.off("position", handler);
        };
    }, [mouse.events]);

    return position;
};

export default useMousePosition;
