/* eslint-disable unicorn/filename-case */

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
import React, { useEffect, useMemo, useRef, useState } from "react";

import { useStdinContext } from "../hooks/use-stdin";
import useStdout from "../hooks/use-stdout";
import { parseSgrMouse } from "./ansi-parser";
import { ANSI_CODES } from "./constants";
import type { MouseButton, MouseClickAction, MouseContextShape, MouseDragAction, MousePosition, MouseScrollAction } from "./mouse-context";
import { MouseContext } from "./mouse-context";

const MouseProvider = ({ children }: PropsWithChildren): React.JSX.Element => {
    const { internal_eventEmitter: internalEventEmitter } = useStdinContext();
    const { stdout } = useStdout();
    // eslint-disable-next-line unicorn/prefer-event-target
    const events = useRef(new EventEmitter());

    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [button, setButton] = useState<MouseButton | null>(null);
    const [click, setClick] = useState<MouseClickAction>(null);
    const [scroll, setScroll] = useState<MouseScrollAction>(null);
    const [drag, setDrag] = useState<MouseDragAction>(null);

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

            setPosition(pos);
            events.current.emit("position", pos);

            switch (event.type) {
                case "click": {
                    setButton(event.button);
                    setClick(event.action);
                    events.current.emit("click", pos, event.action, event.button);

                    clearTimeout(clickTimeoutRef.current);
                    clickTimeoutRef.current = setTimeout(() => {
                        setClick(null);
                        setButton(null);
                    }, 100);
                    break;
                }

                case "drag": {
                    const dragAction = event.action === "press" ? "dragging" : null;

                    setButton(event.button);
                    setDrag(dragAction);
                    events.current.emit("drag", pos, dragAction, event.button);
                    break;
                }

                case "move": {
                    // position already emitted above
                    break;
                }

                case "scroll": {
                    setScroll(event.direction);
                    events.current.emit("scroll", pos, event.direction);

                    clearTimeout(scrollTimeoutRef.current);
                    scrollTimeoutRef.current = setTimeout(() => {
                        setScroll(null);
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
            button,
            click,
            drag,
            events: events.current,
            position,
            scroll,
        };
    }, [button, click, drag, position, scroll]);

    return <MouseContext value={value}>{children}</MouseContext>;
};

export default MouseProvider;
