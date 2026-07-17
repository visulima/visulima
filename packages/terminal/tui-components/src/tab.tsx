/* eslint-disable react/function-component-definition */

/**
 * Tab component for Ink.
 *
 * Inspired by ink-tab by Julien Deniau.
 * @see https://github.com/jdeniau/ink-tab
 *
 * MIT License
 * Copyright (c) Julien Deniau (github.com/jdeniau)
 */
import type { ReactElement, ReactNode } from "react";

export type Props = {
    /**
     * Tab content to render when the tab is active.
     */
    readonly children: ReactNode;

    /**
     * Unique name identifying this tab.
     */
    // eslint-disable-next-line react/no-unused-prop-types, react-x/no-unused-props
    readonly name: string;
};

/**
 * A single tab within a Tabs container.
 * The `name` prop identifies the tab; `children` is rendered when active.
 */
export default function Tab({ children }: Props): ReactElement {
    return <>{children}</>;
}

export { Tab };
export type { Props as TabProps };
