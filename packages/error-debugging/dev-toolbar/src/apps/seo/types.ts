import type { BaseComponents, BaseEvents, Bindable, ViewElement, ViewSpec } from "../../json-view";
import type { JsonLdSchema, MetaTags } from "./analyze";

/** What the panel reads off the page in one pass. */
export interface SeoSnapshot {
    meta: MetaTags;
    schemas: JsonLdSchema[];
}

/** Base vocabulary plus the three rows only this panel draws. */
export type SeoComponents = BaseComponents & {
    GroupHeading: { count: number; label: string; tone: "destructive" | "warning" };
    RawToggleRow: { expanded?: Bindable<boolean>; text: string };
    SummaryRow: { left: string; right?: string };
};

/** The raw-JSON row is the one panel-local component that takes a binding. */
export type SeoEvents = BaseEvents & { RawToggleRow: "click" };

export type SeoElement = ViewElement<SeoComponents, SeoEvents>;

export type SeoSpec = ViewSpec<SeoComponents, SeoEvents>;
