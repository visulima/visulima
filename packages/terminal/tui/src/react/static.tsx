/* eslint-disable react/function-component-definition */
import type { ReactElement, ReactNode } from "react";
import React, { useMemo, useRef } from "react";

export type StaticProps<T> = {
    /**
     * Render function called for each item. Must assign a unique `key` to the
     * root element returned.
     */
    readonly children: (item: T, index: number) => ReactNode;

    /**
     * Array of items to render. Only newly-added items are rendered into the layout —
     * previously rendered items are frozen (never re-rendered or cleared).
     * Ideal for streaming output: completed tasks, log lines, test results.
     */
    readonly items: T[];

    /**
     * Optional styles for the static container Box.
     */
    readonly style?: Record<string, unknown>;
};

/**
 * `&lt;Static>` permanently renders its output above the dynamic UI.
 *
 * Items are rendered once and frozen — they are never re-rendered or cleared.
 * New items appended to `items` are rendered incrementally and accumulate
 * in the layout above the dynamic content.
 *
 * Matches the Ink `&lt;Static>` API exactly.
 * @example
 * ```tsx
 * <Static items={completedTasks}>
 *   {task => (
 *     <Box key={task.id}>
 *       <Text color="green">✔ {task.title}</Text>
 *     </Box>
 *   )}
 * </Static>
 * ```
 */
export function Static<T>({ children: renderItem, items, style }: StaticProps<T>): React.ReactElement {
    // Accumulate all rendered elements across renders.
    // Using a ref (not state) because updates don't need to trigger re-renders —
    // the parent re-renders when `items` changes, at which point we add new elements.
    const committedRef = useRef<ReactElement[]>([]);
    // Track how many items have been committed to avoid duplicate renders.
    const lastIndexRef = useRef(0);

    // Render any new items and accumulate them.
    // This runs during render (not an effect), so the returned JSX always
    // includes the full accumulated list.
    if (items.length > lastIndexRef.current) {
        for (let i = lastIndexRef.current; i < items.length; i++) {
            committedRef.current.push(renderItem(items[i]!, i) as ReactElement);
        }

        lastIndexRef.current = items.length;
    }

    const containerStyle = useMemo(() => {
        return { flexDirection: "column" as const, ...style };
    }, [style]);

    // Return ALL accumulated items every render.
    // React's reconciler reconciles by key, so existing nodes are never remounted —
    // only new ones are added. Previously committed nodes are frozen in the Yoga tree.
    return React.createElement("box", containerStyle, ...committedRef.current);
}
