/** @jsxImportSource preact */
import type { JSX } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";

import type { Spec } from "./catalog";
import { evaluateVisibility, resolveElementProps } from "./resolve";
import type { StateStore } from "./state-store";
import { createStateStore } from "./state-store";
import type { JsonViewAction, JsonViewRegistry } from "./types";

interface JsonViewProps {
    /** Named action handlers referenced by `UIElement.on[event].action`. */
    actions?: Record<string, JsonViewAction>;

    /** Component name → Preact component. */
    registry: JsonViewRegistry;

    /** The view to render. */
    spec: Spec;
}

interface RenderContext {
    actions: Record<string, JsonViewAction>;
    registry: JsonViewRegistry;
    spec: Spec;
    store: StateStore;
}

/** `click` → `onClick`, so an `on` entry lands on the component as a Preact prop. */
const toEventProp = (event: string): string => `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;

/**
 * Render one element by key, then its children.
 *
 * Returns `undefined` — rather than throwing — for a dangling child reference
 * or a `type` the registry does not know, so one bad element cannot blank the
 * whole panel. Use `validateSpec` from `@json-render/core` in a test to catch
 * those at author time instead.
 */
const renderElement = (elementKey: string, context: RenderContext): JSX.Element | undefined => {
    const element = context.spec.elements[elementKey];

    if (!element) {
        return undefined;
    }

    const Component = context.registry[element.type];

    if (!Component) {
        return undefined;
    }

    const stateModel = context.store.getSnapshot();

    if (!evaluateVisibility(element.visible, stateModel)) {
        return undefined;
    }

    const properties = resolveElementProps(element.props ?? {}, stateModel);

    for (const [event, binding] of Object.entries(element.on ?? {})) {
        const bindings = (Array.isArray(binding) ? binding : [binding]).filter(Boolean);

        properties[toEventProp(event)] = (domEvent: Event): void => {
            for (const { action, params, preventDefault } of bindings) {
                if (preventDefault) {
                    domEvent.preventDefault();
                }

                // Re-read rather than closing over `stateModel`: with two
                // bindings on one event, the second must see the first's write.
                context.actions[action]?.(resolveElementProps(params ?? {}, context.store.getSnapshot()), context.store);
            }
        };
    }

    const children = element.children?.map((childKey) => renderElement(childKey, context)).filter(Boolean);

    return (
        <Component key={elementKey} store={context.store} {...properties}>
            {children && children.length > 0 ? children : undefined}
        </Component>
    );
};

/**
 * Render a JSON view spec with Preact components.
 *
 * ponytail: one subscription at the root re-renders the whole tree on any
 * state write. Config panels are a few hundred nodes, so this is cheaper than
 * threading per-path subscriptions; switch to `useSyncExternalStore` per bound
 * element if a panel ever gets large enough to drop frames.
 */
const JsonView = ({ actions = {}, registry, spec }: JsonViewProps): JSX.Element | null => {
    const store = useMemo(() => createStateStore(spec.state ?? {}), [spec]);
    const [, forceRender] = useState(0);

    useEffect(
        () =>
            store.subscribe(() => {
                forceRender((tick) => tick + 1);
            }),
        [store],
    );

    return renderElement(spec.root, { actions, registry, spec, store }) ?? null;
};

export default JsonView;
