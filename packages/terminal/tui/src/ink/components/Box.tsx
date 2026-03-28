/* eslint-disable import/exports-last, react-perf/jsx-no-new-object-as-prop, react-x/no-context-provider, react-x/no-forward-ref, react-x/no-use-context, unicorn/filename-case */
import type { ForwardRefExoticComponent, PropsWithChildren, RefAttributes } from "react";
import { forwardRef, useContext } from "react";
import type { Except } from "type-fest";

import type { DOMElement } from "../dom.js";
import type { Styles } from "../styles.js";
import { accessibilityContext } from "./AccessibilityContext.js";
import { backgroundContext } from "./BackgroundContext.js";

export type Props = Except<Styles, "textWrap"> & {
    /**
     * Hide the element from screen readers.
     */
    readonly "aria-hidden"?: boolean;

    /**
     * A label for the element for screen readers.
     */
    readonly "aria-label"?: string;

    /**
     * The role of the element.
     */
    readonly "aria-role"?:
        | "button"
        | "checkbox"
        | "combobox"
        | "list"
        | "listbox"
        | "listitem"
        | "menu"
        | "menuitem"
        | "option"
        | "progressbar"
        | "radio"
        | "radiogroup"
        | "tab"
        | "tablist"
        | "table"
        | "textbox"
        | "timer"
        | "toolbar";

    /**
     * The state of the element.
     */
    readonly "aria-state"?: {
        readonly busy?: boolean;
        readonly checked?: boolean;
        readonly disabled?: boolean;
        readonly expanded?: boolean;
        readonly multiline?: boolean;
        readonly multiselectable?: boolean;
        readonly readonly?: boolean;
        readonly required?: boolean;
        readonly selected?: boolean;
    };
};

/**
 * `&lt;Box>` is an essential Ink component to build your layout. It's like `&lt;div style="display: flex">` in the browser.
 */
const Box: ForwardRefExoticComponent<PropsWithChildren<Props> & RefAttributes<DOMElement>> = forwardRef<DOMElement, PropsWithChildren<Props>>(
    ({ "aria-hidden": ariaHidden, "aria-label": ariaLabel, "aria-role": role, "aria-state": ariaState, backgroundColor, children, ...style }, ref) => {
        const { isScreenReaderEnabled } = useContext(accessibilityContext);
        const label = ariaLabel ? <ink-text>{ariaLabel}</ink-text> : undefined;

        if (isScreenReaderEnabled && ariaHidden) {
            return null;
        }

        const boxElement = (
            <ink-box
                internal_accessibility={{
                    role,
                    state: ariaState,
                }}
                ref={ref}
                style={{
                    flexDirection: "row",
                    flexGrow: 0,
                    flexShrink: 1,
                    flexWrap: "nowrap",
                    ...style,
                    backgroundColor,
                    overflowX: style.overflowX ?? style.overflow ?? "visible",
                    overflowY: style.overflowY ?? style.overflow ?? "visible",
                }}
            >
                {isScreenReaderEnabled && label ? label : children}
            </ink-box>
        );

        // If this Box has a background color, provide it to children via context
        if (backgroundColor) {
            return <backgroundContext.Provider value={backgroundColor}>{boxElement}</backgroundContext.Provider>;
        }

        return boxElement;
    },
);

Box.displayName = "Box";

export default Box;
