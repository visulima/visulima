import type { StateStore } from "@json-render/core";
import type { ComponentChildren, ComponentType } from "preact";

/**
 * A handler for one named action. Receives the action's resolved `params`
 * (see `ActionBinding.params`) and the view's state store, so a handler can
 * both read and write view state without closing over it.
 */
export type JsonViewAction = (parameters: Record<string, unknown>, store: StateStore) => void;

/**
 * Props every registered component receives.
 *
 * A component gets its element's resolved props spread on top of this, so
 * `children` and `store` are reserved names a catalog prop must not reuse.
 */
export interface JsonViewComponentProps {
    /** Rendered child elements, in `UIElement.children` order. */
    children?: ComponentChildren;

    /** The view's state store, for components that own interactive state. */
    store: StateStore;
}

/**
 * Maps a catalog component name (`UIElement.type`) to the Preact component
 * that renders it. A `type` with no entry renders nothing.
 */
export type JsonViewRegistry = Record<string, ComponentType<any>>;
