/* eslint-disable react/function-component-definition */
import type { ReactElement } from "react";

export type Props = {
    /**
     * Number of newlines to insert.
     * @default 1
     */
    readonly count?: number;
};

/**
 * Adds one or more newline (`\n`) characters. Must be used within `&lt;Text>` components.
 */
export default function Newline({ count = 1 }: Props): ReactElement {
    return <ink-text>{"\n".repeat(count)}</ink-text>;
}

export { Newline };
export type { Props as NewlineProps };
