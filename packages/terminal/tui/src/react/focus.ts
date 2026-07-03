/* eslint-disable @stylistic/no-extra-parens, @typescript-eslint/no-confusing-void-expression, sonarjs/pseudo-random, unicorn/prevent-abbreviations */
import type { Context } from "react";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// ─── Focus context shape ──────────────────────────────────────────────────────

export type FocusContextProps = {
    activate: (id: string) => void;
    activeId: string | undefined;
    add: (id: string, options: { autoFocus: boolean }) => void;
    deactivate: (id: string) => void;
    disableFocus: () => void;
    enableFocus: () => void;
    focus: (id: string) => void;
    focusNext: () => void;
    focusPrevious: () => void;
    remove: (id: string) => void;
};

export const FocusContext: Context<FocusContextProps> = createContext<FocusContextProps>({
    activate() {},
    activeId: undefined,
    add() {},
    deactivate() {},
    disableFocus() {},
    enableFocus() {},
    focus() {},
    focusNext() {},
    focusPrevious() {},
    remove() {},
});

FocusContext.displayName = "TuiFocusContext";

// ─── Focus provider ───────────────────────────────────────────────────────────

type FocusEntry = { autoFocus: boolean; id: string; isActive: boolean };

export const FocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Ordered list of registered focusable components
    const itemsRef = useRef<FocusEntry[]>([]);
    const [activeId, setActiveId] = useState<string | undefined>(undefined);
    const [isEnabled, setIsEnabled] = useState(true);

    const add = useCallback((id: string, options: { autoFocus: boolean }) => {
        // Avoid duplicates
        if (itemsRef.current.some((e) => e.id === id)) {
            return;
        }

        const entry: FocusEntry = { autoFocus: options.autoFocus, id, isActive: true };

        itemsRef.current = [...itemsRef.current, entry];

        // Auto-focus: if no component is focused yet and autoFocus is set
        setActiveId((previous) => {
            if (options.autoFocus && previous === undefined) {
                return id;
            }

            // If this is the first registered component and nothing is focused, focus it
            if (itemsRef.current.filter((e) => e.isActive).length === 1 && previous === undefined) {
                return id;
            }

            return previous;
        });
    }, []);

    const remove = useCallback((id: string) => {
        itemsRef.current = itemsRef.current.filter((e) => e.id !== id);
        setActiveId((previous) => (previous === id ? undefined : previous));
    }, []);

    const activate = useCallback((id: string) => {
        itemsRef.current = itemsRef.current.map((e) => (e.id === id ? { ...e, isActive: true } : e));
    }, []);

    const deactivate = useCallback((id: string) => {
        itemsRef.current = itemsRef.current.map((e) => (e.id === id ? { ...e, isActive: false } : e));
        setActiveId((previous) => (previous === id ? undefined : previous));
    }, []);

    const enableFocus = useCallback(() => setIsEnabled(true), []);
    const disableFocus = useCallback(() => {
        setIsEnabled(false);
        setActiveId(undefined);
    }, []);

    const focusNext = useCallback(() => {
        if (!isEnabled) {
            return;
        }

        const active = itemsRef.current.filter((e) => e.isActive);

        if (active.length === 0) {
            return;
        }

        setActiveId((previous) => {
            if (previous === undefined) {
                return active[0]?.id;
            }

            const index = active.findIndex((e) => e.id === previous);

            return active[(index + 1) % active.length]?.id ?? active[0]?.id;
        });
    }, [isEnabled]);

    const focusPrevious = useCallback(() => {
        if (!isEnabled) {
            return;
        }

        const active = itemsRef.current.filter((e) => e.isActive);

        if (active.length === 0) {
            return;
        }

        setActiveId((previous) => {
            if (previous === undefined) {
                return active.at(-1)?.id;
            }

            const index = active.findIndex((e) => e.id === previous);

            return active[(index - 1 + active.length) % active.length]?.id ?? active.at(-1)?.id;
        });
    }, [isEnabled]);

    const focus = useCallback(
        (id: string) => {
            if (!isEnabled) {
                return;
            }

            if (itemsRef.current.some((e) => e.id === id && e.isActive)) {
                setActiveId(id);
            }
        },
        [isEnabled],
    );

    const value = useMemo<FocusContextProps>(() => {
        return {
            activate,
            activeId,
            add,
            deactivate,
            disableFocus,
            enableFocus,
            focus,
            focusNext,
            focusPrevious,
            remove,
        };
    }, [activeId, add, remove, activate, deactivate, enableFocus, disableFocus, focusNext, focusPrevious, focus]);

    return React.createElement(FocusContext.Provider, { value }, children);
};

// ─── useFocus ─────────────────────────────────────────────────────────────────

export type UseFocusOptions = {
    autoFocus?: boolean;
    id?: string;
    isActive?: boolean;
};

export type UseFocusResult = {
    focus: (id: string) => void;
    isFocused: boolean;
};

export const useFocus = ({ autoFocus = false, id: customId, isActive = true }: UseFocusOptions = {}): UseFocusResult => {
    const { activate, activeId, add, deactivate, focus, remove } = useContext(FocusContext);

    const id = useMemo(() => customId ?? Math.random().toString(36).slice(2, 7), [customId]);

    useEffect(() => {
        add(id, { autoFocus });

        return () => {
            remove(id);
        };
    }, [id, autoFocus]);

    useEffect(() => {
        if (isActive) {
            activate(id);
        } else {
            deactivate(id);
        }
    }, [isActive, id]);

    return {
        focus,
        isFocused: Boolean(id) && activeId === id,
    };
};

// ─── useFocusManager ─────────────────────────────────────────────────────────

export type UseFocusManagerResult = {
    activeId: string | undefined;
    disableFocus: () => void;
    enableFocus: () => void;
    focus: (id: string) => void;
    focusNext: () => void;
    focusPrevious: () => void;
};

export const useFocusManager = (): UseFocusManagerResult => {
    const context = useContext(FocusContext);

    return {
        activeId: context.activeId,
        disableFocus: context.disableFocus,
        enableFocus: context.enableFocus,
        focus: context.focus,
        focusNext: context.focusNext,
        focusPrevious: context.focusPrevious,
    };
};
