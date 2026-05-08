/* eslint-disable react-perf/jsx-no-new-object-as-prop, react-x/no-context-provider, react-x/no-forward-ref, react-x/no-use-context */
import type { ForwardRefExoticComponent, PropsWithChildren, ReactNode, RefAttributes } from "react";
import { forwardRef, useContext } from "react";
import type { Except } from "type-fest";

import type { DOMElement } from "../ink/dom";
import type { Styles } from "../ink/styles";
import { accessibilityContext } from "./accessibility-context";
import { backgroundContext } from "./background-context";

const BOX_BASE_STYLE = {
    flexDirection: "row",
    flexGrow: 0,
    flexShrink: 1,
    flexWrap: "nowrap",
} as const;

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

    /**
     * Whether this element is opaque (prevents rendering of covered content beneath it).
     * Useful for performance optimization with layered content.
     */
    readonly opaque?: boolean;

    /**
     * Whether to render a scrollbar for this scrollable element.
     * Only applies when `overflow` is `'scroll'`. Defaults to `true`.
     */
    readonly scrollbar?: boolean;

    /**
     * Makes this element sticky within its scroll container.
     * - `true` or `'top'`: pinned to the top during scroll
     * - `'bottom'`: pinned to the bottom during scroll
     */
    readonly sticky?: boolean | "top" | "bottom";

    /**
     * Alternate content to render when this element is in its sticky (pinned) state.
     * Only applies when `sticky` is set. When omitted, the normal children are used.
     */
    readonly stickyChildren?: ReactNode;
};

/**
 * `&lt;Box>` is an essential Ink component to build your layout. It's like `&lt;div style="display: flex">` in the browser.
 */
const Box: ForwardRefExoticComponent<PropsWithChildren<Props> & RefAttributes<DOMElement>> = forwardRef<DOMElement, PropsWithChildren<Props>>(
    (
        {
            "aria-hidden": ariaHidden,
            "aria-label": ariaLabel,
            "aria-role": role,
            "aria-state": ariaState,
            backgroundColor,
            children,
            opaque,
            scrollbar,
            sticky,
            stickyChildren,
            ...style
        },
        ref,
    ) => {
        const { isScreenReaderEnabled } = useContext(accessibilityContext);
        const label = ariaLabel ? <ink-text>{ariaLabel}</ink-text> : undefined;
        const accessibility = role || ariaState ? { role, state: ariaState } : undefined;

        if (isScreenReaderEnabled && ariaHidden) {
            return null;
        }

        const boxElement = (
            <ink-box
                internal_accessibility={accessibility}
                opaque={opaque}
                ref={ref}
                scrollbar={scrollbar}
                sticky={sticky}
                style={{
                    ...BOX_BASE_STYLE,
                    ...style,
                    backgroundColor,
                    overflowX: style.overflowX ?? style.overflow ?? "visible",
                    overflowY: style.overflowY ?? style.overflow ?? "visible",
                }}
            >
                {isScreenReaderEnabled && label ? label : children}
                {sticky && stickyChildren && !isScreenReaderEnabled ? (
                    <ink-box
                        internalStickyAlternate
                        style={{
                            position: "absolute",
                            ...style,
                        }}
                    >
                        {stickyChildren}
                    </ink-box>
                ) : null}
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

export { Box };
export type { Props as BoxProps };
