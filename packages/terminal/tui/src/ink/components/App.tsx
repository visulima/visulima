/* eslint-disable @typescript-eslint/no-unnecessary-condition, no-cond-assign, no-for-of-array/no-for-of-array, no-plusplus, react-x/no-context-provider, react-x/no-unnecessary-use-callback, sonarjs/no-nested-functions, unicorn/filename-case, unicorn/prefer-event-target */
import { EventEmitter } from "node:events";
import process from "node:process";

import { cursorShow } from "@visulima/ansi";
import type { ReactNode } from "react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createInputParser } from "../input-parser";
import type { CursorPosition } from "../log-update";
import AppContext from "./AppContext";
import CursorContext from "./CursorContext";
import ErrorBoundary from "./ErrorBoundary";
import FocusContext from "./FocusContext";
import StderrContext from "./StderrContext";
import StdinContext from "./StdinContext";
import StdoutContext from "./StdoutContext";

const tab = "\t";
const shiftTab = "\u001B[Z";
const escape = "\u001B";

type Props = {
    readonly children: ReactNode;
    readonly exitOnCtrlC: boolean;
    readonly interactive: boolean;
    readonly onExit: (errorOrResult?: unknown) => void;
    readonly onWaitUntilRenderFlush: () => Promise<void>;
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
    onWaitUntilRenderFlush,
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

    // Count how many components enabled raw mode to avoid disabling
    // raw mode until all components don't need it anymore
    const rawModeEnabledCount = useRef(0);
    // Count how many components enabled bracketed paste mode
    const bracketedPasteModeEnabledCount = useRef(0);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const internal_eventEmitter = useRef(new EventEmitter());

    // Each useInput hook adds a listener, so the count can legitimately exceed the default limit of 10.
    internal_eventEmitter.current.setMaxListeners(Infinity);
    // Store the currently attached readable listener to avoid stale closure issues
    const readableListenerRef = useRef<(() => void) | undefined>(undefined);
    const inputParserRef = useRef(createInputParser());
    const pendingInputFlushRef = useRef<NodeJS.Timeout | undefined>(undefined);
    // Small delay to let chunked escape sequences complete before flushing as literal input.
    const pendingInputFlushDelayMilliseconds = 20;

    const clearPendingInputFlush = useCallback((): void => {
        if (!pendingInputFlushRef.current) {
            return;
        }

        clearTimeout(pendingInputFlushRef.current);
        pendingInputFlushRef.current = undefined;
    }, []);

    // Determines if TTY is supported on the provided stdin
    const isRawModeSupported = stdin.isTTY;

    const detachReadableListener = useCallback((): void => {
        if (!readableListenerRef.current) {
            return;
        }

        stdin.removeListener("readable", readableListenerRef.current);
        readableListenerRef.current = undefined;
    }, [stdin]);

    const disableRawMode = useCallback((): void => {
        stdin.setRawMode(false);
        detachReadableListener();
        stdin.unref();
        rawModeEnabledCount.current = 0;
        inputParserRef.current.reset();
        clearPendingInputFlush();
    }, [stdin, detachReadableListener, clearPendingInputFlush]);

    const handleExit = useCallback(
        (errorOrResult?: unknown): void => {
            if (isRawModeSupported && rawModeEnabledCount.current > 0) {
                disableRawMode();
            }

            onExit(errorOrResult);
        },
        [isRawModeSupported, disableRawMode, onExit],
    );

    const handleInput = useCallback(
        (input: string): void => {
            // Exit on Ctrl+C — use includes() to handle multi-byte input buffers
            // where Ctrl+C may be embedded within a larger chunk
            // eslint-disable-next-line unicorn/no-hex-escape
            if (input.includes("\x03") && exitOnCtrlC) {
                handleExit();

                return;
            }

            // Reset focus when there's an active focused component on Esc
            if (input === escape) {
                setActiveFocusId((currentActiveFocusId) => {
                    if (currentActiveFocusId) {
                        return undefined;
                    }

                    return currentActiveFocusId;
                });
            }
        },
        [exitOnCtrlC, handleExit],
    );

    const emitInput = useCallback(
        (input: string): void => {
            handleInput(input);
            internal_eventEmitter.current.emit("input", input);
        },
        [handleInput],
    );

    const schedulePendingInputFlush = useCallback((): void => {
        clearPendingInputFlush();
        pendingInputFlushRef.current = setTimeout(() => {
            pendingInputFlushRef.current = undefined;
            const pendingEscape = inputParserRef.current.flushPendingEscape();

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
            const inputEvents = inputParserRef.current.push(chunk);

            for (const event of inputEvents) {
                if (typeof event === "string") {
                    emitInput(event);
                } else {
                    // Keep paste on a separate channel from `useInput` so key handlers
                    // don't need to branch on mixed key-vs-paste event shapes.
                    if (internal_eventEmitter.current.listenerCount("paste") === 0) {
                        emitInput(event.paste);
                        continue;
                    }

                    internal_eventEmitter.current.emit("paste", event.paste);
                }
            }
        }

        if (inputParserRef.current.hasPendingEscape()) {
            schedulePendingInputFlush();
        }
    }, [stdin, emitInput, clearPendingInputFlush, schedulePendingInputFlush]);

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
                // Ensure raw mode is enabled only once
                if (rawModeEnabledCount.current === 0) {
                    stdin.ref();
                    stdin.setRawMode(true);
                    // Store the listener reference to avoid stale closure when removing
                    readableListenerRef.current = handleReadable;
                    stdin.addListener("readable", handleReadable);
                }

                rawModeEnabledCount.current++;

                return;
            }

            // Disable raw mode only when no components left that are using it
            if (rawModeEnabledCount.current === 0) {
                return;
            }

            if (--rawModeEnabledCount.current === 0) {
                disableRawMode();
            }
        },
        [isRawModeSupported, stdin, handleReadable, disableRawMode],
    );

    const handleSetBracketedPasteMode = useCallback(
        (isEnabled: boolean): void => {
            if (!stdout.isTTY) {
                return;
            }

            if (isEnabled) {
                if (bracketedPasteModeEnabledCount.current === 0) {
                    stdout.write("\u001B[?2004h");
                }

                bracketedPasteModeEnabledCount.current++;

                return;
            }

            if (bracketedPasteModeEnabledCount.current === 0) {
                return;
            }

            if (--bracketedPasteModeEnabledCount.current === 0) {
                stdout.write("\u001B[?2004l");
            }
        },
        [stdout],
    );

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

    // Handle tab navigation via effect that subscribes to input events
    useEffect(() => {
        const handleTabNavigation = (input: string): void => {
            if (!isFocusEnabled || focusablesCountRef.current === 0)
                return;

            if (input === tab) {
                focusNext();
            }

            if (input === shiftTab) {
                focusPrevious();
            }
        };

        internal_eventEmitter.current.on("input", handleTabNavigation);
        const emitter = internal_eventEmitter.current;

        return () => {
            emitter.off("input", handleTabNavigation);
        };
    }, [isFocusEnabled, focusNext, focusPrevious]);

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

            if (isRawModeSupported && rawModeEnabledCount.current > 0) {
                disableRawMode();
            }

            if (bracketedPasteModeEnabledCount.current > 0) {
                if (stdout.isTTY && canWriteToStdout) {
                    stdout.write("\u001B[?2004l");
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
            waitUntilRenderFlush: onWaitUntilRenderFlush,
        };
    }, [handleExit, onWaitUntilRenderFlush]);

    const stdinContextValue = useMemo(() => {
        return {
            internal_eventEmitter: internal_eventEmitter.current,

            internal_exitOnCtrlC: exitOnCtrlC,
            isRawModeSupported,
            setBracketedPasteMode: handleSetBracketedPasteMode,
            setRawMode: handleSetRawMode,
            stdin,
        };
    }, [stdin, handleSetRawMode, handleSetBracketedPasteMode, isRawModeSupported, exitOnCtrlC]);

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

    return (
        <AppContext.Provider value={appContextValue}>
            <StdinContext.Provider value={stdinContextValue}>
                <StdoutContext.Provider value={stdoutContextValue}>
                    <StderrContext.Provider value={stderrContextValue}>
                        <FocusContext.Provider value={focusContextValue}>
                            <CursorContext.Provider value={cursorContextValue}>
                                <ErrorBoundary onError={handleExit}>{children}</ErrorBoundary>
                            </CursorContext.Provider>
                        </FocusContext.Provider>
                    </StderrContext.Provider>
                </StdoutContext.Provider>
            </StdinContext.Provider>
        </AppContext.Provider>
    );
};

App.displayName = "InternalApp";

export default App as React.FC<Props>;
