/**
 * Ported from @zenobius/ink-mouse (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

import { useContext } from "react";

import { MouseContext } from "./mouse-context";
import type { MouseContextShape } from "./mouse-context";

function useMouseContext(): MouseContextShape {
    const context = useContext(MouseContext);

    if (!context) {
        throw new Error("useMouseContext must only be used within children of <MouseProvider/>");
    }

    return context;
}

export { useMouseContext };
