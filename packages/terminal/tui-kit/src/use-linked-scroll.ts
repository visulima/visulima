import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ScrollViewRef } from "./scroll/scroll-view";

export type UseLinkedScrollReturn = {
    /**
     * Callback to pass to ScrollView's `onScroll` prop.
     * Broadcasts the scroll position to all linked instances.
     */
    onScroll: (scrollOffset: number) => void;

    /**
     * Ref to attach to the ScrollView component.
     * Used internally to call `scrollTo()` when other instances scroll.
     */
    ref: RefObject<ScrollViewRef | null>;
};

export type LinkedScrollGroup = {
    /**
     * Hook that returns a ref and onScroll callback for linking a ScrollView
     * to this group. Call once per ScrollView instance.
     */
    useLinkedScroll: () => UseLinkedScrollReturn;
};

type Listener = {
    ref: RefObject<ScrollViewRef | null>;
    setOffset: (offset: number) => void;
};

/**
 * Creates a linked scroll group that synchronizes scroll position
 * across multiple ScrollView instances.
 * @example
 * ```tsx
 * const group = createLinkedScrollGroup();
 *
 * const PanelA = () => {
 *     const { ref, onScroll } = group.useLinkedScroll();
 *     return <ScrollView ref={ref} onScroll={onScroll}>...</ScrollView>;
 * };
 *
 * const PanelB = () => {
 *     const { ref, onScroll } = group.useLinkedScroll();
 *     return <ScrollView ref={ref} onScroll={onScroll}>...</ScrollView>;
 * };
 * ```
 */
const createLinkedScrollGroup = (): LinkedScrollGroup => {
    const listeners = new Set<Listener>();
    let broadcasting = false;

    const useLinkedScroll = (): UseLinkedScrollReturn => {
        const scrollRef = useRef<ScrollViewRef | null>(null);
        const [, setTick] = useState(0);

        const listener: Listener = {
            ref: scrollRef,
            setOffset: () => {
                setTick((t) => t + 1);
            },
        };

        const listenerRef = useRef(listener);

        listenerRef.current = listener;

        useEffect(() => {
            const { current } = listenerRef;

            listeners.add(current);

            return () => {
                listeners.delete(current);
            };
        }, []);

        const onScroll = useCallback((scrollOffset: number) => {
            if (broadcasting) {
                return;
            }

            broadcasting = true;

            try {
                for (const l of listeners) {
                    if (l.ref !== scrollRef) {
                        l.ref.current?.scrollTo(scrollOffset);
                    }
                }
            } finally {
                broadcasting = false;
            }
        }, []);

        return { onScroll, ref: scrollRef };
    };

    return { useLinkedScroll };
};

export default createLinkedScrollGroup;

export { createLinkedScrollGroup };
