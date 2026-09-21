import type { ComponentChildren, ComponentType } from "preact";

import type { StateBinding } from "./resolve";
import type { StateStore } from "./state-store";

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

/**
 * A registry checked against a component map: every name is present, and each
 * component's props match the catalog entry. `baseRegistry` is typed with
 * this so renaming a prop in the catalog fails the build rather than silently
 * diverging from the component.
 */
export type CheckedRegistry<Components> = {
    [Name in keyof Components]: ComponentType<Partial<JsonViewComponentProps> & Resolved<Components[Name]>>;
};

/**
 * The props a component actually receives.
 *
 * A catalog prop may be written as `{ $state }` by the spec author, but the
 * renderer resolves every binding before the component sees it — so the
 * component's own type is the binding-free one.
 */
export type Resolved<Properties> = {
    [Key in keyof Properties]: Exclude<Properties[Key], StateBinding>;
};
