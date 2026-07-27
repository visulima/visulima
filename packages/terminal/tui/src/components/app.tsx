/* eslint-disable @typescript-eslint/no-unnecessary-condition, no-cond-assign, react-x/no-context-provider, sonarjs/no-nested-functions */
/* eslint-disable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-pass-data-to-parent -- App is the root component; its effects legitimately drive imperative terminal I/O (raw mode, bracketed paste, input-control registration) and cannot be lifted to a parent. */
import { EventEmitter } from "node:events";
import process from "node:process";

import { BracketedPasteMode, cursorShow, resetMode, setMode } from "@visulima/ansi";
import type { ReactNode } from "react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createInputParser } from "../ink/input-parser";
import type { CursorPosition } from "../ink/log-update";
import AnimationContext from "./animation-context";
import type { Props as AppContextProps } from "./app-context";
import AppContext from "./app-context";
import CursorContext from "./cursor-context";
import ErrorBoundary from "./error-boundary";
import FocusContext from "./focus-context";
import StderrContext from "./stderr-context";
import StdinContext from "./stdin-context";
import StdoutContext from "./stdout-context";

const tab = "\t";
const shiftTab = "\u001B[Z";
const escape = "\u001B";

// Precomputed once at module load — `BracketedPasteMode` is a DEC private mode
// (code 2004) exported by @visulima/ansi; setMode/resetMode emit `CSI ?2004h/l`.
const enableBracketedPaste = setMode(BracketedPasteMode);
const disableBracketedPaste = resetMode(BracketedPasteMode);

type AnimationSubscriber = {
    readonly callback: (currentTime: number) => void;
    readonly interval: number;
    nextDueTime: number;
    readonly startTime: number;
};

type Props = {
    readonly children: ReactNode;
    readonly exitOnCtrlC: boolean;
    readonly interactive: boolean;
    readonly onExit: (errorOrResult?: unknown) => void;

    /**
     * Registers the App's input pause/resume callbacks with the Ink instance so
     * `suspendTerminal()` can hand raw mode + bracketed paste to a child process.
     */
    readonly onRegisterInputControl: (pauseInput: () => void, resumeInput: () => void) => void;
    readonly onSuspendTerminal: AppContextProps["suspendTerminal"];
    readonly onWaitUntilRenderFlush: () => Promise<void>;
    readonly renderThrottleMs: number;
    readonly setCursorPosition: (position: CursorPosition | undefined) => void;
    readonly stderr: NodeJS.WriteStream;
    readonly stdin: NodeJS.ReadStream;
    readonly stdout: NodeJS.WriteStream;
    readonly writeToStderr: (data: string) => void;
    readonly writeToStdout: (data: string) => void;
};

type Focusable = {
    readonly id: string;
    readonly isActive: boolean;
};

// Root component for all Ink apps
// It renders stdin and stdout contexts, so that children can access them if needed
// It also handles Ctrl+C exiting and cursor visibility
const App = ({
    children,
    exitOnCtrlC,
    interactive,
    onExit,
    onRegisterInputControl,
    onSuspendTerminal,
    onWaitUntilRenderFlush,
    renderThrottleMs,
    setCursorPosition,
    stderr,
    stdin,
    stdout,
    writeToStderr,
    writeToStdout,
}: Props): React.ReactNode => {
    const [isFocusEnabled, setIsFocusEnabled] = useState(true);
    const [activeFocusId, setActiveFocusId] = useState<string | undefined>(undefined);
    // Focusables array is managed internally via setFocusables callback pattern

    const [, setFocusables] = useState<Focusable[]>([]);
    // Track focusables count for tab navigation check (avoids stale closure)
    const focusablesCountRef = useRef(0);
    const animationSubscribersRef = useRef(new Map<(currentTime: number) => void, AnimationSubscriber>());
    const animationTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Count how many components enabled raw mode to avoid disabling
    // raw mode until all components don't need it anymore
    const rawModeEnabledCount = useRef(0);
    // Tracks a deferred terminal raw-mode teardown queued via queueMicrotask.
    // Lets a same-render useInput swap keep the terminal in raw mode without a disable/enable cycle.
    const pendingDisableRawModeRef = useRef(false);
    // Count how many components enabled bracketed paste mode
    const bracketedPasteModeEnabledCount = useRef(0);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const [internal_eventEmitter] = useState(() => {
        const emitter = new EventEmitter();

        // Each useInput hook adds a listener, so the count can legitimately exceed the default limit of 10.
        emitter.setMaxListeners(Infinity);

        return emitter;
    });
    // Store the currently attached readable listener to avoid stale closure issues
    const readableListenerRef = useRef<(() => void) | undefined>(undefined);
    const inputParserRef = useRef<ReturnType<typeof createInputParser> | undefined>(undefined);

    inputParserRef.current ??= createInputParser();

    const pendingInputFlushRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const didWarnAboutDeprecatedPasteFallbackRef = useRef(false);
    // Small delay to let chunked escape sequences complete before flushing as literal input.
    const pendingInputFlushDelayMilliseconds = 20;

    const clearPendingInputFlush = useCallback((): void => {
        if (!pendingInputFlushRef.current) {
            return;
        }

        clearTimeout(pendingInputFlushRef.current);
        pendingInputFlushRef.current = undefined;
    }, []);

    const clearAnimationTimer = useCallback((): void => {
        if (!animationTimerRef.current) {
            return;
        }

        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = undefined;
    }, []);

    const scheduleAnimationTick = useCallback((): void => {
        clearAnimationTimer();

        if (animationSubscribersRef.current.size === 0) {
            return;
        }

        let nextDueTime = Number.POSITIVE_INFINITY;

        for (const subscriber of animationSubscribersRef.current.values()) {
            // One shared timer is enough as long as it wakes at the earliest
            // subscriber deadline and lets slower animations skip that tick.
            nextDueTime = Math.min(nextDueTime, subscriber.nextDueTime);
        }

        const delay = Math.max(0, nextDueTime - performance.now());

        animationTimerRef.current = setTimeout(() => {
            animationTimerRef.current = undefined;

            const currentTime = performance.now();

            // Snapshot subscribers before iterating so that a synchronous
            // unsubscribe (e.g. via flushSync) cannot mutate the Map mid-loop.
            const subscribers = [...animationSubscribersRef.current.values()];

            for (const subscriber of subscribers) {
                if (currentTime < subscriber.nextDueTime) {
                    continue;
                }

                subscriber.callback(currentTime);

                const elapsedTime = currentTime - subscriber.startTime;
                const elapsedFrames = Math.floor(elapsedTime / subscriber.interval) + 1;

                // Advance from elapsed time rather than callback count so delayed
                // ticks catch up instead of stretching the animation timeline.
                subscriber.nextDueTime = subscriber.startTime + elapsedFrames * subscriber.interval;
            }

            scheduleAnimationTick();
        }, delay);
        // Keep the timer ref'd while animations are active so `useAnimation()`
        // can drive process lifetime in both interactive and non-interactive apps.
    }, [clearAnimationTimer]);

    const animationSubscribe = useCallback(
        (callback: (currentTime: number) => void, interval: number): { readonly startTime: number; readonly unsubscribe: () => void } => {
            const startTime = performance.now();

            // The scheduler owns the start timestamp so hooks can derive frames from
            // the exact same origin that determines each subscriber's due time.
            animationSubscribersRef.current.set(callback, {
                callback,
                interval,
                nextDueTime: startTime + interval,
                startTime,
            });

            scheduleAnimationTick();

            return {
                startTime,
                unsubscribe() {
                    animationSubscribersRef.current.delete(callback);

                    if (animationSubscribersRef.current.size === 0) {
                        clearAnimationTimer();

                        return;
                    }

                    scheduleAnimationTick();
                },
            };
        },
        [clearAnimationTimer, scheduleAnimationTick],
    );

    useEffect(
        () => () => {
            clearAnimationTimer();
        },
        [clearAnimationTimer],
    );

    // Determines if TTY is supported on the provided stdin
    const isRawModeSupported = stdin.isTTY;

    const detachReadableListener = useCallback((): void => {
        if (!readableListenerRef.current) {
            return;
        }

        stdin.removeListener("readable", readableListenerRef.current);
        readableListenerRef.current = undefined;
    }, [stdin]);

    const clearInputState = useCallback((): void => {
        inputParserRef.current?.reset();
        clearPendingInputFlush();
        detachReadableListener();
    }, [clearPendingInputFlush, detachReadableListener]);

    const disableRawMode = useCallback((): void => {
        pendingDisableRawModeRef.current = false;
        stdin.setRawMode(false);
        stdin.unref();
        rawModeEnabledCount.current = 0;
        clearInputState();
    }, [stdin, clearInputState]);

    const handleExit = useCallback(
        (errorOrResult?: unknown): void => {
            if (isRawModeSupported && (rawModeEnabledCount.current > 0 || pendingDisableRawModeRef.current)) {
                disableRawMode();
            }

            onExit(errorOrResult);
        },
        [isRawModeSupported, disableRawMode, onExit],
    );

    const handleInput = useCallback(
        (input: string): void => {
            // eslint-disable-next-line unicorn/no-hex-escape
            if (input.includes("\x03") && exitOnCtrlC) {
                handleExit();

                return;
            }

            if (input === escape && isFocusEnabled) {
                setActiveFocusId((currentActiveFocusId) => {
                    if (currentActiveFocusId) {
                        return undefined;
                    }

                    return currentActiveFocusId;
                });
            }
        },
        [exitOnCtrlC, handleExit, isFocusEnabled],
    );

    const emitInput = useCallback(
        (input: string): void => {
            handleInput(input);
            internal_eventEmitter.emit("input", input);
        },
        [handleInput, internal_eventEmitter],
    );

    const schedulePendingInputFlush = useCallback((): void => {
        clearPendingInputFlush();
        pendingInputFlushRef.current = setTimeout(() => {
            pendingInputFlushRef.current = undefined;
            const pendingEscape = inputParserRef.current!.flushPendingEscape();

            if (!pendingEscape) {
                return;
            }

            emitInput(pendingEscape);
        }, pendingInputFlushDelayMilliseconds);
    }, [clearPendingInputFlush, emitInput]);

    const handleReadable = useCallback((): void => {
        clearPendingInputFlush();
        let chunk;

        while ((chunk = stdin.read() as string | null) !== null) {
            const inputEvents = inputParserRef.current!.push(chunk);

            for (const event of inputEvents) {
                if (typeof event === "string") {
                    emitInput(event);
                } else {
                    if (internal_eventEmitter.listenerCount("paste") === 0) {
                        if (!didWarnAboutDeprecatedPasteFallbackRef.current) {
                            didWarnAboutDeprecatedPasteFallbackRef.current = true;
                            writeToStderr(
                                "Warning: useInput() received bracketed paste because no usePaste() handler is active. "
                                + "This fallback is deprecated and will be removed in the next major version. "
                                + "Migrate paste handling to usePaste().\n",
                            );
                        }

                        emitInput(event.paste);
                        continue;
                    }

                    internal_eventEmitter.emit("paste", event.paste);
                }
            }
        }

        if (inputParserRef.current!.hasPendingEscape()) {
            schedulePendingInputFlush();
        }
    }, [stdin, emitInput, clearPendingInputFlush, schedulePendingInputFlush, writeToStderr, internal_eventEmitter]);

    const attachReadableListener = useCallback((): void => {
        if (readableListenerRef.current) {
            return;
        }

        // Store the listener reference to avoid stale closure when removing
        readableListenerRef.current = handleReadable;
        stdin.addListener("readable", handleReadable);
    }, [stdin, handleReadable]);

    const handleSetRawMode = useCallback(
        (isEnabled: boolean): void => {
            if (!isRawModeSupported) {
                if (stdin === process.stdin) {
                    throw new Error(
                        "Raw mode is not supported on the current process.stdin, which Ink uses as input stream by default.\nRead about how to prevent this error on https://github.com/vadimdemedes/ink/#israwmodesupported",
                    );
                } else {
                    throw new Error(
                        "Raw mode is not supported on the stdin provided to Ink.\nRead about how to prevent this error on https://github.com/vadimdemedes/ink/#israwmodesupported",
                    );
                }
            }

            stdin.setEncoding("utf8");

            if (isEnabled) {
                if (rawModeEnabledCount.current === 0) {
                    // A same-render component swap may have detached input handling while
                    // leaving terminal raw mode enabled until the queued disable runs.
                    const isRawModeAlreadyEnabled = pendingDisableRawModeRef.current;

                    pendingDisableRawModeRef.current = false;

                    if (!isRawModeAlreadyEnabled) {
                        stdin.ref();
                        stdin.setRawMode(true);
                    }

                    attachReadableListener();
                }

                rawModeEnabledCount.current++;

                return;
            }

            if (rawModeEnabledCount.current === 0) {
                return;
            }

            if (--rawModeEnabledCount.current === 0) {
                // Stop owning input immediately so pending parser state cannot leak into
                // a replacement useInput component mounted in the same React update.
                clearInputState();

                // Defer the terminal raw-mode teardown so a same-render replacement can
                // keep the process ref and raw mode active without a disable/enable cycle.
                pendingDisableRawModeRef.current = true;
                queueMicrotask(() => {
                    if (!pendingDisableRawModeRef.current) {
                        return;
                    }

                    disableRawMode();
                });
            }
        },
        [isRawModeSupported, stdin, attachReadableListener, clearInputState, disableRawMode],
    );

    const handleSetBracketedPasteMode = useCallback(
        (isEnabled: boolean): void => {
            if (!stdout.isTTY) {
                return;
            }

            if (isEnabled) {
                if (bracketedPasteModeEnabledCount.current === 0) {
                    stdout.write(enableBracketedPaste);
                }

                bracketedPasteModeEnabledCount.current++;

                return;
            }

            if (bracketedPasteModeEnabledCount.current === 0) {
                return;
            }

            if (--bracketedPasteModeEnabledCount.current === 0) {
                stdout.write(disableBracketedPaste);
            }
        },
        [stdout],
    );

    // Remembers which input modes were active so resumeInput can reinstate exactly
    // what was on — the ownership counts are left untouched so components still
    // "own" raw mode / bracketed paste across the suspension.
    const suspendedInputStateRef = useRef({ bracketedPaste: false, rawMode: false });

    const pauseInput = useCallback((): void => {
        const wasRawMode = isRawModeSupported && (rawModeEnabledCount.current > 0 || pendingDisableRawModeRef.current);
        const wasBracketedPaste = bracketedPasteModeEnabledCount.current > 0;

        suspendedInputStateRef.current = { bracketedPaste: wasBracketedPaste, rawMode: wasRawMode };

        if (wasBracketedPaste && stdout.isTTY) {
            stdout.write(disableBracketedPaste);
        }

        if (wasRawMode) {
            // Hand raw mode + input listeners back to the terminal without resetting
            // the counts. Cancel any queued deferred disable so it can't fire mid-suspension.
            pendingDisableRawModeRef.current = false;
            clearInputState();
            stdin.setRawMode(false);
            stdin.unref();
        }
    }, [isRawModeSupported, stdout, stdin, clearInputState]);

    const resumeInput = useCallback((): void => {
        const { bracketedPaste, rawMode } = suspendedInputStateRef.current;

        if (rawMode) {
            stdin.ref();
            stdin.setRawMode(true);
            stdin.setEncoding("utf8");
            attachReadableListener();
        }

        if (bracketedPaste && stdout.isTTY) {
            stdout.write(enableBracketedPaste);
        }
    }, [stdin, stdout, attachReadableListener]);

    // Register on every commit so a child component that calls suspendTerminal()
    // reaches the current pause/resume closures.
    useEffect(() => {
        onRegisterInputControl(pauseInput, resumeInput);
    }, [onRegisterInputControl, pauseInput, resumeInput]);

    // Focus navigation helpers
    const findNextFocusable = useCallback((currentFocusables: Focusable[], currentActiveFocusId: string | undefined): string | undefined => {
        const activeIndex = currentFocusables.findIndex((focusable) => focusable.id === currentActiveFocusId);

        for (let index = activeIndex + 1; index < currentFocusables.length; index++) {
            const focusable = currentFocusables[index];

            if (focusable?.isActive) {
                return focusable.id;
            }
        }

        return undefined;
    }, []);

    const findPreviousFocusable = useCallback((currentFocusables: Focusable[], currentActiveFocusId: string | undefined): string | undefined => {
        const activeIndex = currentFocusables.findIndex((focusable) => focusable.id === currentActiveFocusId);

        for (let index = activeIndex - 1; index >= 0; index--) {
            const focusable = currentFocusables[index];

            if (focusable?.isActive) {
                return focusable.id;
            }
        }

        return undefined;
    }, []);

    const focusNext = useCallback((): void => {
        setFocusables((currentFocusables) => {
            setActiveFocusId((currentActiveFocusId) => {
                const firstFocusableId = currentFocusables.find((focusable) => focusable.isActive)?.id;
                const nextFocusableId = findNextFocusable(currentFocusables, currentActiveFocusId);

                return nextFocusableId ?? firstFocusableId;
            });

            return currentFocusables;
        });
    }, [findNextFocusable]);

    const focusPrevious = useCallback((): void => {
        setFocusables((currentFocusables) => {
            setActiveFocusId((currentActiveFocusId) => {
                const lastFocusableId = currentFocusables.findLast((focusable) => focusable.isActive)?.id;
                const previousFocusableId = findPreviousFocusable(currentFocusables, currentActiveFocusId);

                return previousFocusableId ?? lastFocusableId;
            });

            return currentFocusables;
        });
    }, [findPreviousFocusable]);

    useEffect(() => {
        const handleTabNavigation = (input: string): void => {
            if (!isFocusEnabled || focusablesCountRef.current === 0) {
                return;
            }

            if (input === tab) {
                focusNext();
            }

            if (input === shiftTab) {
                focusPrevious();
            }
        };

        internal_eventEmitter.on("input", handleTabNavigation);
        const emitter = internal_eventEmitter;

        return () => {
            emitter.off("input", handleTabNavigation);
        };
    }, [isFocusEnabled, focusNext, focusPrevious, internal_eventEmitter]);

    const enableFocus = useCallback((): void => {
        setIsFocusEnabled(true);
    }, []);

    const disableFocus = useCallback((): void => {
        setIsFocusEnabled(false);
    }, []);

    const focus = useCallback((id: string): void => {
        setFocusables((currentFocusables) => {
            const hasFocusableId = currentFocusables.some((focusable) => focusable?.id === id);

            if (hasFocusableId) {
                setActiveFocusId(id);
            }

            return currentFocusables;
        });
    }, []);

    const addFocusable = useCallback((id: string, { autoFocus }: { autoFocus: boolean }): void => {
        setFocusables((currentFocusables) => {
            focusablesCountRef.current = currentFocusables.length + 1;

            return [
                ...currentFocusables,
                {
                    id,
                    isActive: true,
                },
            ];
        });

        if (autoFocus) {
            setActiveFocusId((currentActiveFocusId) => {
                if (!currentActiveFocusId) {
                    return id;
                }

                return currentActiveFocusId;
            });
        }
    }, []);

    const removeFocusable = useCallback((id: string): void => {
        setActiveFocusId((currentActiveFocusId) => {
            if (currentActiveFocusId === id) {
                return undefined;
            }

            return currentActiveFocusId;
        });

        setFocusables((currentFocusables) => {
            const filtered = currentFocusables.filter((focusable) => focusable.id !== id);

            focusablesCountRef.current = filtered.length;

            return filtered;
        });
    }, []);

    const activateFocusable = useCallback((id: string): void => {
        setFocusables((currentFocusables) =>
            currentFocusables.map((focusable) => {
                if (focusable.id !== id) {
                    return focusable;
                }

                return {
                    id,
                    isActive: true,
                };
            }),
        );
    }, []);

    const deactivateFocusable = useCallback((id: string): void => {
        setActiveFocusId((currentActiveFocusId) => {
            if (currentActiveFocusId === id) {
                return undefined;
            }

            return currentActiveFocusId;
        });

        setFocusables((currentFocusables) =>
            currentFocusables.map((focusable) => {
                if (focusable.id !== id) {
                    return focusable;
                }

                return {
                    id,
                    isActive: false,
                };
            }),
        );
    }, []);

    // Handle cursor visibility, raw mode, and bracketed paste mode cleanup on unmount
    useEffect(
        () => () => {
            const canWriteToStdout = !stdout.destroyed && !stdout.writableEnded;

            if (interactive && canWriteToStdout) {
                stdout.write(cursorShow);
            }

            if (isRawModeSupported && (rawModeEnabledCount.current > 0 || pendingDisableRawModeRef.current)) {
                disableRawMode();
            }

            if (bracketedPasteModeEnabledCount.current > 0) {
                if (stdout.isTTY && canWriteToStdout) {
                    stdout.write(disableBracketedPaste);
                }

                bracketedPasteModeEnabledCount.current = 0;
            }
        },
        [stdout, isRawModeSupported, disableRawMode, interactive],
    );

    // Memoize context values to prevent unnecessary re-renders
    const appContextValue = useMemo(() => {
        return {
            exit: handleExit,
            suspendTerminal: onSuspendTerminal,
            waitUntilRenderFlush: onWaitUntilRenderFlush,
        };
    }, [handleExit, onSuspendTerminal, onWaitUntilRenderFlush]);

    const stdinContextValue = useMemo(() => {
        return {
            internal_eventEmitter,

            internal_exitOnCtrlC: exitOnCtrlC,
            isRawModeSupported,
            setBracketedPasteMode: handleSetBracketedPasteMode,
            setRawMode: handleSetRawMode,
            stdin,
        };
    }, [stdin, handleSetRawMode, handleSetBracketedPasteMode, isRawModeSupported, exitOnCtrlC, internal_eventEmitter]);

    const stdoutContextValue = useMemo(() => {
        return {
            stdout,
            write: writeToStdout,
        };
    }, [stdout, writeToStdout]);

    const stderrContextValue = useMemo(() => {
        return {
            stderr,
            write: writeToStderr,
        };
    }, [stderr, writeToStderr]);

    const cursorContextValue = useMemo(() => {
        return {
            setCursorPosition,
        };
    }, [setCursorPosition]);

    const focusContextValue = useMemo(() => {
        return {
            activate: activateFocusable,
            activeId: activeFocusId,
            add: addFocusable,
            deactivate: deactivateFocusable,
            disableFocus,
            enableFocus,
            focus,
            focusNext,
            focusPrevious,
            remove: removeFocusable,
        };
    }, [activeFocusId, addFocusable, removeFocusable, activateFocusable, deactivateFocusable, enableFocus, disableFocus, focusNext, focusPrevious, focus]);

    const animationContextValue = useMemo(() => {
        return {
            renderThrottleMs,
            subscribe: animationSubscribe,
        };
    }, [animationSubscribe, renderThrottleMs]);

    return (
        <AppContext.Provider value={appContextValue}>
            <StdinContext.Provider value={stdinContextValue}>
                <StdoutContext.Provider value={stdoutContextValue}>
                    <StderrContext.Provider value={stderrContextValue}>
                        <FocusContext.Provider value={focusContextValue}>
                            <AnimationContext.Provider value={animationContextValue}>
                                <CursorContext.Provider value={cursorContextValue}>
                                    <ErrorBoundary onError={handleExit}>{children}</ErrorBoundary>
                                </CursorContext.Provider>
                            </AnimationContext.Provider>
                        </FocusContext.Provider>
                    </StderrContext.Provider>
                </StdoutContext.Provider>
            </StdinContext.Provider>
        </AppContext.Provider>
    );
};

App.displayName = "InternalApp";

export default App as React.FC<Props>;
