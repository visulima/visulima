import type { ActionBinding, Spec, VisibilityCondition } from "@json-render/core";

/**
 * Props of every base component, keyed by the `type` a spec element uses.
 *
 * This is the contract a spec builder is checked against: moving a panel from
 * JSX to JSON gives up the compiler's per-prop checking, and this map buys it
 * back without shipping a runtime validator.
 *
 * Declared as a type alias rather than an interface on purpose — only an
 * alias of object literals gets TypeScript's implicit index signature, which
 * is what lets these props satisfy `UIElement`'s `Record&lt;string, unknown>`.
 */
export type BaseComponents = {
    HeaderBar: {
        actionLabel?: string;
        badges?: { label: string; variant?: "default" | "destructive" | "info" | "outline" | "secondary" | "success" | "warning" }[];
        chips?: { label: string; title?: string }[];
    };
    KeyValue: { label: string; value?: unknown };
    Note: { text: string };
    PairTable: { keyLabel: string; keyTone?: "amber" | "primary"; rows: { key: string; value: string }[]; showCopy?: boolean; valueLabel: string };
    Row: { value: string };
    Section: { title?: string };
    Stack: { class?: string; variant?: "bare" | "pane" };
    StatStrip: { stats: { label: string; value: number | string }[] };
    TabView: { tabs: { label: string; value: string }[] };
};

/** Any component map a view can be built against. */
export type ComponentMap = Record<string, Record<string, unknown>>;

/** One spec element, discriminated on `type`, with props checked per component. */
export type ViewElement<Components extends ComponentMap = BaseComponents> = {
    [Name in keyof Components & string]: {
        children?: string[];
        on?: Record<string, ActionBinding | ActionBinding[]>;
        props: Components[Name];
        type: Name;
        visible?: VisibilityCondition;
    };
}[keyof Components & string];

/**
 * A `@json-render/core` spec whose elements are checked against a component
 * map. Pass a map extending {@link BaseComponents} to add app-local components.
 */
export type ViewSpec<Components extends ComponentMap = BaseComponents> = Omit<Spec, "elements"> & {
    elements: Record<string, ViewElement<Components>>;
};
