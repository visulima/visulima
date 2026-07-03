/* eslint-disable react/function-component-definition */

/**
 * Alert component for Ink.
 *
 * Inspired by ink-ui Alert by Vadim Demedes.
 * @see https://github.com/vadimdemedes/ink-ui
 *
 * MIT License
 * Copyright (c) Vadym Demedes (github.com/vadimdemedes)
 */
import type { ReactElement, ReactNode } from "react";

import Box from "./box";
import Text from "./text";
import type { Variant } from "./variant-config";
import VARIANT_CONFIG from "./variant-config";

export type AlertVariant = Variant;

export type Props = {
    /**
     * Alert message content.
     */
    readonly children: ReactNode;

    /**
     * Optional heading displayed above the message.
     */
    readonly title?: string;

    /**
     * Determines the border color and icon.
     */
    readonly variant: AlertVariant;
};

/**
 * Renders a bordered alert box with a variant-specific icon, optional title, and message.
 */
export default function Alert({ children, title, variant }: Props): ReactElement {
    const { color, icon } = VARIANT_CONFIG[variant];

    return (
        <Box borderColor={color} borderStyle="round" flexGrow={1} gap={1} paddingX={1}>
            <Box flexShrink={0}>
                <Text color={color}>{icon}</Text>
            </Box>
            <Box flexDirection="column" flexGrow={1} flexShrink={1} gap={1} minWidth={0}>
                {title ? <Text bold>{title}</Text> : undefined}
                <Text>{children}</Text>
            </Box>
        </Box>
    );
}

export { Alert };
export type { Props as AlertProps };
