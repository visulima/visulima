import type { Severity, ValidationMessage } from "../ui";
import type { VisibilityCondition } from "./resolve";
import type { StateModel } from "./state-store";

/** One action dispatch: a handler name plus the params it is called with. */
export interface ActionBinding {
    /** Name of a handler passed to `JsonView`'s `actions`. */
    action: string;

    /** Passed to the handler; `$state` bindings resolve before the call. */
    params?: Record<string, unknown>;

    /** Call `preventDefault()` on the DOM event first. */
    preventDefault?: boolean;
}

/** One element of a view: a component name, its props, and its children's keys. */
export interface UIElement {
    children?: string[];

    /**
     * Loose here on purpose: the renderer accepts any event name, while
     * {@link ViewElement} narrows it per component so a spec cannot bind one
     * the component ignores.
     */
    on?: Partial<Record<string, ActionBinding | ActionBinding[]>>;
    props: Record<string, unknown>;
    type: string;
    visible?: VisibilityCondition;
}

/**
 * A view: a flat map of elements reachable from `root`, plus the state its
 * bindings read. Flat rather than nested so a spec diffs and patches cleanly.
 */
export interface Spec {
    elements: Record<string, UIElement>;
    root: string;
    state?: StateModel;
}

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
    CodeBlock: { code: string };
    DisclosureHeader: { expanded?: Bindable<boolean>; label: string; severity: Severity; title: string };
    EmptyState: { hint?: string; icon: string; title: string; tone?: "muted" | "success" };
    HeaderBar: {
        actionLabel?: string;
        badges?: { label: string; variant?: "default" | "destructive" | "info" | "outline" | "secondary" | "success" | "warning" }[];
        chips?: { label: string; title?: string }[];
    };
    KeyValue: { label: string; value?: unknown };
    MessageList: { emptyText?: string; messages: ValidationMessage[] };
    MetaRow: { label: string; required?: boolean; value: string };
    Note: { text: string };
    PairTable: { keyLabel: string; keyTone?: "amber" | "primary"; rows: { key: string; value: string }[]; showCopy?: boolean; valueLabel: string };
    Row: { value: string };
    Section: { title?: string; variant?: "accent" | "card" | "plain" };
    SerpSnippet: {
        description: string;
        favicon?: string;
        isMobile?: boolean;
        issues: string[];
        label: string;
        siteName: string;
        title: string;
        url: string;
    };
    SocialCard: { accentClass?: string; description: string; image: string; missing: string[]; name: string; title: string; url: string };
    Stack: { class?: string; variant?: "bare" | "grid" | "pane" };
    StatStrip: { stats: { label: string; value: number | string }[] };
    TabView: { actionLabel?: string; tabs: { badge?: number; badgeVariant?: "destructive" | "warning"; label: string; value: string }[] };
    TagCard: { description: string; label: string; priority: "recommended" | "required"; snippet: string };
    Text: { text: string; tone?: "body" | "caption" };
};

/**
 * A prop a spec may either set outright or bind to a state path.
 *
 * The renderer resolves the binding before the component sees it, so the
 * component's own prop type stays the plain value.
 */
export type Bindable<T> = T | { $state: string };

/** Any component map a view can be built against. */
export type ComponentMap = Record<string, Record<string, unknown>>;

/**
 * The event each component actually listens for, keyed by component name.
 *
 * A component reads its handler from an `on&lt;Event>` prop, and the renderer
 * derives that prop name from the `on` key. Declaring the pair here is what
 * stops a spec binding `click` to a component that only offers `onAction` —
 * which renders a button that does nothing, silently. A component absent from
 * this map accepts no bindings at all.
 */
export type BaseEvents = {
    DisclosureHeader: "click";
    HeaderBar: "action";
    TabView: "action";
};

/** Any event map a view can be built against. */
export type EventMap = Record<string, string>;

/** One spec element, discriminated on `type`, with props checked per component. */
export type ViewElement<Components extends ComponentMap = BaseComponents, Events extends EventMap = BaseEvents> = {
    [Name in keyof Components & string]: {
        children?: string[];
        on?: Partial<Record<Name extends keyof Events ? Events[Name] : never, ActionBinding | ActionBinding[]>>;
        props: Components[Name];
        type: Name;
        visible?: VisibilityCondition;
    };
}[keyof Components & string];

/**
 * A `@json-render/core` spec whose elements are checked against a component
 * map. Pass a map extending {@link BaseComponents} to add app-local components.
 */
export type ViewSpec<Components extends ComponentMap = BaseComponents, Events extends EventMap = BaseEvents> = Omit<Spec, "elements"> & {
    elements: Record<string, ViewElement<Components, Events>>;
};
