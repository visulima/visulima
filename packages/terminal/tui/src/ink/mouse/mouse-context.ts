/**
 * Ported from `\@zenobius/ink-mouse` (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

import type { EventEmitter } from "node:events";

import type { Context } from "react";
import { createContext } from "react";

type MousePosition = {
    x: number;
    y: number;
};

type MouseButton = "left" | "middle" | "right";

type MouseClickAction = "press" | "release" | null;
type MouseScrollAction = "scrolldown" | "scrollup" | null;
type MouseDragAction = "dragging" | null;

type MouseAction = MouseClickAction | MouseDragAction | MouseScrollAction;

/**
 * Internal event emitter for mouse state changes.
 *
 * Events:
 * - "position" (position: MousePosition)
 * - "click" (position: MousePosition, action: MouseClickAction, button: MouseButton)
 * - "scroll" (position: MousePosition, direction: MouseScrollAction)
 * - "drag" (position: MousePosition, action: MouseDragAction, button: MouseButton)
 */
type MouseEvents = EventEmitter;

type MouseContextShape = {
    readonly button: MouseButton | null;
    readonly click: MouseClickAction;
    readonly drag: MouseDragAction;
    readonly events: MouseEvents;
    readonly position: MousePosition;
    readonly scroll: MouseScrollAction;
};

// eslint-disable-next-line unicorn/no-null
const MouseContext: Context<MouseContextShape | null> = createContext<MouseContextShape | null>(null);

MouseContext.displayName = "MouseContext";

export { MouseContext };
export type { MouseAction, MouseButton, MouseClickAction, MouseContextShape, MouseDragAction, MouseEvents, MousePosition, MouseScrollAction };
