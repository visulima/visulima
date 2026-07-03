/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { SpinnerName } from "@visulima/spinner";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Spinner from "./spinner";
import Text from "./text";

export type Props = {
    /**
     * Optional message rendered after the spinner.
     */
    readonly children?: ReactNode;

    /**
     * Color used for the spinner and label.
     * @default "cyan"
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Spinner preset.
     * @default "dots"
     */
    readonly type?: SpinnerName;
};

/**
 * Compact spinner + label for loading states.
 */
export default function LoadingIndicator({ children, color = "cyan", type = "dots" }: Props): ReactElement {
    return (
        <Box gap={1}>
            <Text color={color}>
                <Spinner type={type} />
            </Text>
            {children === undefined ? undefined : <Text color={color}>{children}</Text>}
        </Box>
    );
}

export { LoadingIndicator };
export type { Props as LoadingIndicatorProps };
