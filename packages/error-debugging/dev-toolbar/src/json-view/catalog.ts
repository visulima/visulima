import type { ActionBinding, Spec, VisibilityCondition } from "@json-render/core";

import type { Severity, ValidationMessage } from "./components/message-list";

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
