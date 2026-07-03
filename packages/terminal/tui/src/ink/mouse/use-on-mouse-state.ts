/**
 * Ported from `\@zenobius/ink-mouse` (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

import type { RefObject } from "react";
import { useState } from "react";

import type { DOMElement } from "../dom";
import { useOnMouseClick } from "./use-on-mouse-click";
import useOnMouseHover from "./use-on-mouse-hover";

const useOnMouseState = (ref: RefObject<DOMElement | null>): { clicking: boolean; hovering: boolean } => {
    const [hovering, setHovering] = useState(false);
    const [clicking, setClicking] = useState(false);

    useOnMouseClick(ref, setClicking);
    useOnMouseHover(ref, setHovering);

    return { clicking, hovering };
};

export default useOnMouseState;
