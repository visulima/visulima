/* eslint-disable react-x/no-use-context, react/function-component-definition */
import type { ReactElement, ReactNode } from "react";
import { useContext } from "react";

import { accessibilityContext } from "./accessibility-context";

const TRANSFORM_STYLE = { flexDirection: "row", flexGrow: 0, flexShrink: 1 } as const;

export type Props = {
    /**
     * Screen-reader-specific text to output. If this is set, all children will be ignored.
     */
    readonly accessibilityLabel?: string;

    readonly children?: ReactNode;

    /**
     * Function that transforms children output. It accepts children and must return transformed children as well. Note that when children use `&lt;Text>` styling props (e.g. `color`, `bold`), the string will contain ANSI escape codes.
     */
    readonly transform: (children: string, index: number) => string;
};

/**
 * Transform a string representation of React components before they're written to output. For example, you might want to apply a gradient to text, add a clickable link, or create some text effects. These use cases can't accept React nodes as input; they expect a string. That's what the &lt;Transform> component does: it gives you an output string of its child components and lets you transform it in any way.
 */
export default function Transform({ accessibilityLabel, children, transform }: Props): ReactElement | null {
    const { isScreenReaderEnabled } = useContext(accessibilityContext);

    if (children === undefined || children === null) {
        return null;
    }

    return (
        <ink-text internal_transform={transform} style={TRANSFORM_STYLE}>
            {isScreenReaderEnabled && accessibilityLabel ? accessibilityLabel : children}
        </ink-text>
    );
}

export { Transform };
export type { Props as TransformProps };
