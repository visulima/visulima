/**
 * Ported from `\@zenobius/ink-mouse` (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

import { useContext } from "react";

import type { MouseContextShape } from "./mouse-context";
import { MouseContext } from "./mouse-context";

const useMouseContext = (): MouseContextShape => {
    const context = useContext(MouseContext);

    if (!context) {
        throw new Error("useMouseContext must only be used within children of <MouseProvider/>");
    }

    return context;
};

export default useMouseContext;
