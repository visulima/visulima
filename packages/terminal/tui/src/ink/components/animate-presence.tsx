/* eslint-disable react/function-component-definition */
import type { ReactElement, ReactNode } from "react";
import { Children, cloneElement, isValidElement, useCallback, useEffect, useState } from "react";

import Box from "./box";

type AnimatableProps = {
    readonly onExit?: () => void;
    readonly show?: boolean;
};

export type Props = {
    /**
     * Keyed children. Any child that accepts a `show: boolean` prop and calls
     * `onExit` when its exit transition finishes (such as `<Transition />`) is
     * orchestrated automatically. Other children render as-is.
     */
    readonly children: ReactNode;
};

type Slot = {
    readonly element: ReactElement<AnimatableProps>;
    readonly key: string;
    readonly show: boolean;
};

const getKey = (element: ReactElement): string | undefined => {
    const key = element.key;

    return key == null ? undefined : String(key);
};

const isAnimatable = (element: ReactElement): element is ReactElement<AnimatableProps> =>
    typeof element.props === "object" && element.props !== null && "show" in element.props;

/**
 * Orchestrates enter / exit animations for keyed children. Wrap a dynamic
 * list of `<Transition />` (or any component accepting `show` + `onExit`) to
 * keep outgoing children mounted until their exit animation finishes.
 */
export default function AnimatePresence({ children }: Props): ReactElement {
    const [slots, setSlots] = useState<ReadonlyArray<Slot>>(() => {
        const collected: Slot[] = [];

        Children.forEach(children, (child) => {
            if (!isValidElement(child)) {
                return;
            }

            const key = getKey(child);

            if (key === undefined) {
                return;
            }

            collected.push({
                element: isAnimatable(child) ? child : (child as ReactElement<AnimatableProps>),
                key,
                show: true,
            });
        });

        return collected;
    });

    // Reconcile children on every render — additions marked show=true,
    // removals flipped to show=false so they can animate out. Persisting
    // keys simply get their element updated.
    useEffect(() => {
        const incoming = new Map<string, ReactElement<AnimatableProps>>();

        Children.forEach(children, (child) => {
            if (!isValidElement(child)) {
                return;
            }

            const key = getKey(child);

            if (key === undefined) {
                return;
            }

            incoming.set(key, isAnimatable(child) ? child : (child as ReactElement<AnimatableProps>));
        });

        setSlots((previous) => {
            const next: Slot[] = [];
            const seen = new Set<string>();
            let changed = false;

            for (const slot of previous) {
                if (incoming.has(slot.key)) {
                    const nextElement = incoming.get(slot.key)!;

                    if (!slot.show || slot.element !== nextElement) {
                        changed = true;
                    }

                    next.push({
                        element: nextElement,
                        key: slot.key,
                        show: true,
                    });
                    seen.add(slot.key);
                } else {
                    if (slot.show) {
                        changed = true;
                    }

                    // Removed in the incoming render; keep rendering with show=false.
                    next.push({ ...slot, show: false });
                }
            }

            for (const [key, element] of incoming) {
                if (!seen.has(key)) {
                    changed = true;
                    next.push({ element, key, show: true });
                }
            }

            // React bails out of the update if we return the same reference,
            // preventing an infinite effect/setState loop when `children` gets
            // a fresh JSX identity each parent render but is functionally
            // unchanged.
            return changed ? next : previous;
        });
    }, [children]);

    const removeSlot = useCallback((key: string) => {
        setSlots((previous) => previous.filter((slot) => slot.key !== key));
    }, []);

    return (
        <Box flexDirection="column">
            {slots.map((slot) => {
                if (!isAnimatable(slot.element)) {
                    return slot.element;
                }

                const originalOnExit = slot.element.props.onExit;

                return cloneElement(slot.element, {
                    key: slot.key,
                    onExit: () => {
                        originalOnExit?.();
                        removeSlot(slot.key);
                    },
                    show: slot.show,
                });
            })}
        </Box>
    );
}
