/* eslint-disable @stylistic/no-extra-parens, @typescript-eslint/no-confusing-void-expression, unicorn/prevent-abbreviations */
import type { Context } from "react";
import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";

// ─── Focus context shape ──────────────────────────────────────────────────────

export type FocusContextProps = {
    activate: (id: string, holder?: string) => void;
    activeId: string | undefined;
    add: (id: string, options: { autoFocus: boolean }) => void;
    deactivate: (id: string, holder?: string) => void;
    disableFocus: () => void;
    enableFocus: () => void;
    focus: (id: string) => void;
    focusNext: () => void;
    focusPrevious: () => void;
    remove: (id: string, holder?: string) => void;
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
    // Components registered under the same ID share one Tab stop; it goes away with the last of them.
    const holdersRef = useRef(new Map<string, number>());
    // Holders of a shared ID that switched to inactive; the Tab stop is active while any holder is.
    const inactiveRef = useRef(new Map<string, Set<string>>());
    const [activeId, setActiveId] = useState<string | undefined>(undefined);
    const [isEnabled, setIsEnabled] = useState(true);
    const isEnabledRef = useRef(true);

    isEnabledRef.current = isEnabled;

    const add = useCallback((id: string, options: { autoFocus: boolean }) => {
        holdersRef.current.set(id, (holdersRef.current.get(id) ?? 0) + 1);

        // Shared ID: already a Tab stop
        if (itemsRef.current.some((e) => e.id === id)) {
            return;
        }

        const entry: FocusEntry = { autoFocus: options.autoFocus, id, isActive: true };

        itemsRef.current = [...itemsRef.current, entry];

        if (!isEnabledRef.current) {
            return;
        }

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

    const syncActive = useCallback((id: string) => {
        const holders = holdersRef.current.get(id) ?? 0;
        const isActive = (inactiveRef.current.get(id)?.size ?? 0) < holders;

        itemsRef.current = itemsRef.current.map((e) => (e.id === id ? { ...e, isActive } : e));

        if (!isActive) {
            setActiveId((previous) => (previous === id ? undefined : previous));
        }
    }, []);

    const remove = useCallback(
        (id: string, holder = "") => {
            const holders = (holdersRef.current.get(id) ?? 1) - 1;

            inactiveRef.current.get(id)?.delete(holder);

            if (holders > 0) {
                holdersRef.current.set(id, holders);
                syncActive(id);

                return;
            }

            holdersRef.current.delete(id);
            inactiveRef.current.delete(id);
            itemsRef.current = itemsRef.current.filter((e) => e.id !== id);
            setActiveId((previous) => (previous === id ? undefined : previous));
        },
        [syncActive],
    );

    const setHolderActive = useCallback(
        (id: string, holder: string, isActive: boolean) => {
            const inactive = inactiveRef.current.get(id) ?? new Set<string>();

            if (isActive) {
                inactive.delete(holder);
            } else {
                inactive.add(holder);
            }

            inactiveRef.current.set(id, inactive);
            syncActive(id);
        },
        [syncActive],
    );

    const activate = useCallback((id: string, holder = "") => setHolderActive(id, holder, true), [setHolderActive]);

    const deactivate = useCallback((id: string, holder = "") => setHolderActive(id, holder, false), [setHolderActive]);

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

    const generatedId = useId();
    const id = customId ?? generatedId;
    // Identifies this hook instance among the components that share an ID.
    const holder = useId();

    useEffect(() => {
        add(id, { autoFocus });

        return () => {
            remove(id, holder);
        };
    }, [id, autoFocus]);

    useEffect(() => {
        if (isActive) {
            activate(id, holder);
        } else {
            deactivate(id, holder);
        }
    }, [isActive, id, holder]);

    return {
        focus,
        isFocused: activeId === id,
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
