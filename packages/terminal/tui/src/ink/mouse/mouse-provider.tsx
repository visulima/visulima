/**
 * Ported from `\@zenobius/ink-mouse` (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 *
 * Rewritten to integrate with the ink input pipeline instead of
 * listening on process.stdin directly.
 */

import { EventEmitter } from "node:events";
import process from "node:process";

import type { PropsWithChildren } from "react";
import React, { useEffect, useMemo, useReducer, useRef } from "react";

import { useStdinContext } from "../hooks/use-stdin";
import useStdout from "../hooks/use-stdout";
import { parseSgrMouse } from "./ansi-parser";
import { ANSI_CODES } from "./constants";
import type { MouseButton, MouseClickAction, MouseContextShape, MouseDragAction, MousePosition, MouseScrollAction } from "./mouse-context";
import { MouseContext } from "./mouse-context";

type MouseState = {
    button: MouseButton | null;
    click: MouseClickAction;
    drag: MouseDragAction;
    position: MousePosition;
    scroll: MouseScrollAction;
};

type MouseAction =
    | { button: MouseButton; click: MouseClickAction; position: MousePosition; type: "click" }
    | { type: "click-reset" }
    | { button: MouseButton; drag: MouseDragAction; position: MousePosition; type: "drag" }
    | { position: MousePosition; type: "move" }
    | { position: MousePosition; scroll: MouseScrollAction; type: "scroll" }
    | { type: "scroll-reset" };

const initialMouseState: MouseState = {
    button: null,
    click: null,
    drag: null,
    position: { x: 0, y: 0 },
    scroll: null,
};

const mouseReducer = (state: MouseState, action: MouseAction): MouseState => {
    switch (action.type) {
        case "click": {
            return { ...state, button: action.button, click: action.click, position: action.position };
        }

        case "click-reset": {
            return { ...state, button: null, click: null };
        }

        case "drag": {
            return { ...state, button: action.button, drag: action.drag, position: action.position };
        }

        case "move": {
            return { ...state, position: action.position };
        }

        case "scroll": {
            return { ...state, position: action.position, scroll: action.scroll };
        }

        case "scroll-reset": {
            return { ...state, scroll: null };
        }

        default: {
            return state;
        }
    }
};

const MouseProvider = ({ children }: PropsWithChildren): React.JSX.Element => {
    const { internal_eventEmitter: internalEventEmitter } = useStdinContext();
    const { stdout } = useStdout();

    const events = useRef(new EventEmitter());

    const [state, dispatch] = useReducer(mouseReducer, initialMouseState);

    const clickTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Enable mouse tracking on mount, disable on unmount
    useEffect(() => {
        const out = stdout.isTTY ? stdout : process.stdout;

        out.write(ANSI_CODES.mouseButton.on + ANSI_CODES.mouseMotion.on + ANSI_CODES.mouseMotionOthers.on + ANSI_CODES.mouseSGR.on);

        return () => {
            out.write(ANSI_CODES.mouseSGR.off + ANSI_CODES.mouseMotionOthers.off + ANSI_CODES.mouseMotion.off + ANSI_CODES.mouseButton.off);
        };
    }, [stdout]);

    // Listen for mouse sequences on ink's input event emitter
    useEffect(() => {
        const handleInput = (input: string): void => {
            const event = parseSgrMouse(input);

            if (!event) {
                return;
            }

            const pos: MousePosition = { x: event.x, y: event.y };

            events.current.emit("position", pos);

            switch (event.type) {
                case "click": {
                    dispatch({ button: event.button, click: event.action, position: pos, type: "click" });
                    events.current.emit("click", pos, event.action, event.button);

                    clearTimeout(clickTimeoutRef.current);
                    clickTimeoutRef.current = setTimeout(() => {
                        dispatch({ type: "click-reset" });
                    }, 100);
                    break;
                }

                case "drag": {
                    const dragAction = event.action === "press" ? "dragging" : null;

                    dispatch({ button: event.button, drag: dragAction, position: pos, type: "drag" });
                    events.current.emit("drag", pos, dragAction, event.button);
                    break;
                }

                case "move": {
                    dispatch({ position: pos, type: "move" });
                    break;
                }

                case "scroll": {
                    dispatch({ position: pos, scroll: event.direction, type: "scroll" });
                    events.current.emit("scroll", pos, event.direction);

                    clearTimeout(scrollTimeoutRef.current);
                    scrollTimeoutRef.current = setTimeout(() => {
                        dispatch({ type: "scroll-reset" });
                    }, 100);
                    break;
                }

                default: {
                    break;
                }
            }
        };

        internalEventEmitter.on("input", handleInput);

        return () => {
            internalEventEmitter.off("input", handleInput);
            clearTimeout(clickTimeoutRef.current);
            clearTimeout(scrollTimeoutRef.current);
        };
    }, [internalEventEmitter]);

    const value: MouseContextShape = useMemo(() => {
        return {
            button: state.button,
            click: state.click,
            drag: state.drag,
            events: events.current,
            position: state.position,
            scroll: state.scroll,
        };
    }, [state]);

    return <MouseContext value={value}>{children}</MouseContext>;
};

export default MouseProvider;
