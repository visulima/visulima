import React, { createContext, type Context, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// ─── Focus context shape ──────────────────────────────────────────────────────

export type FocusContextProps = {
    activeId: string | undefined;
    add: (id: string, options: { autoFocus: boolean }) => void;
    remove: (id: string) => void;
    activate: (id: string) => void;
    deactivate: (id: string) => void;
    enableFocus: () => void;
    disableFocus: () => void;
    focusNext: () => void;
    focusPrevious: () => void;
    focus: (id: string) => void;
};

export const FocusContext: Context<FocusContextProps> = createContext<FocusContextProps>({
    activeId: undefined,
    add() {},
    remove() {},
    activate() {},
    deactivate() {},
    enableFocus() {},
    disableFocus() {},
    focusNext() {},
    focusPrevious() {},
    focus() {},
});

FocusContext.displayName = "RatatatFocusContext";

// ─── Focus provider ───────────────────────────────────────────────────────────

type FocusEntry = { id: string; isActive: boolean; autoFocus: boolean };

export const FocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Ordered list of registered focusable components
    const itemsRef = useRef<FocusEntry[]>([]);
    const [activeId, setActiveId] = useState<string | undefined>(undefined);
    const [isEnabled, setIsEnabled] = useState(true);

    const add = useCallback((id: string, options: { autoFocus: boolean }) => {
        // Avoid duplicates
        if (itemsRef.current.some((e) => e.id === id)) return;
        const entry: FocusEntry = { id, isActive: true, autoFocus: options.autoFocus };
        itemsRef.current = [...itemsRef.current, entry];

        // Auto-focus: if no component is focused yet and autoFocus is set
        setActiveId((prev) => {
            if (options.autoFocus && prev === undefined) return id;
            // If this is the first registered component and nothing is focused, focus it
            if (itemsRef.current.filter((e) => e.isActive).length === 1 && prev === undefined) return id;
            return prev;
        });
    }, []);

    const remove = useCallback((id: string) => {
        itemsRef.current = itemsRef.current.filter((e) => e.id !== id);
        setActiveId((prev) => (prev === id ? undefined : prev));
    }, []);

    const activate = useCallback((id: string) => {
        itemsRef.current = itemsRef.current.map((e) => (e.id === id ? { ...e, isActive: true } : e));
    }, []);

    const deactivate = useCallback((id: string) => {
        itemsRef.current = itemsRef.current.map((e) => (e.id === id ? { ...e, isActive: false } : e));
        setActiveId((prev) => (prev === id ? undefined : prev));
    }, []);

    const enableFocus = useCallback(() => setIsEnabled(true), []);
    const disableFocus = useCallback(() => {
        setIsEnabled(false);
        setActiveId(undefined);
    }, []);

    const focusNext = useCallback(() => {
        if (!isEnabled) return;
        const active = itemsRef.current.filter((e) => e.isActive);
        if (active.length === 0) return;
        setActiveId((prev) => {
            if (prev === undefined) return active[0]?.id;
            const idx = active.findIndex((e) => e.id === prev);
            return active[(idx + 1) % active.length]?.id ?? active[0]?.id;
        });
    }, [isEnabled]);

    const focusPrevious = useCallback(() => {
        if (!isEnabled) return;
        const active = itemsRef.current.filter((e) => e.isActive);
        if (active.length === 0) return;
        setActiveId((prev) => {
            if (prev === undefined) return active[active.length - 1]?.id;
            const idx = active.findIndex((e) => e.id === prev);
            return active[(idx - 1 + active.length) % active.length]?.id ?? active[active.length - 1]?.id;
        });
    }, [isEnabled]);

    const focus = useCallback(
        (id: string) => {
            if (!isEnabled) return;
            if (itemsRef.current.some((e) => e.id === id && e.isActive)) {
                setActiveId(id);
            }
        },
        [isEnabled],
    );

    const value = useMemo<FocusContextProps>(
        () => ({
            activeId,
            add,
            remove,
            activate,
            deactivate,
            enableFocus,
            disableFocus,
            focusNext,
            focusPrevious,
            focus,
        }),
        [activeId, add, remove, activate, deactivate, enableFocus, disableFocus, focusNext, focusPrevious, focus],
    );

    return React.createElement(FocusContext.Provider, { value }, children);
};

// ─── useFocus ─────────────────────────────────────────────────────────────────

export type UseFocusOptions = {
    isActive?: boolean;
    autoFocus?: boolean;
    id?: string;
};

export type UseFocusResult = {
    isFocused: boolean;
    focus: (id: string) => void;
};

export const useFocus = ({ isActive = true, autoFocus = false, id: customId }: UseFocusOptions = {}): UseFocusResult => {
    const { activeId, add, remove, activate, deactivate, focus } = useContext(FocusContext);

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
        isFocused: Boolean(id) && activeId === id,
        focus,
    };
};

// ─── useFocusManager ─────────────────────────────────────────────────────────

export type UseFocusManagerResult = {
    enableFocus: () => void;
    disableFocus: () => void;
    focusNext: () => void;
    focusPrevious: () => void;
    focus: (id: string) => void;
    activeId: string | undefined;
};

export const useFocusManager = (): UseFocusManagerResult => {
    const ctx = useContext(FocusContext);
    return {
        enableFocus: ctx.enableFocus,
        disableFocus: ctx.disableFocus,
        focusNext: ctx.focusNext,
        focusPrevious: ctx.focusPrevious,
        focus: ctx.focus,
        activeId: ctx.activeId,
    };
};
