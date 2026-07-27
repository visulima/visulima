/* eslint-disable react/function-component-definition */

/**
 * Status message component for Ink.
 *
 * Inspired by ink-ui StatusMessage by Vadim Demedes.
 * @see https://github.com/vadimdemedes/ink-ui
 *
 * MIT License
 * Copyright (c) Vadym Demedes (github.com/vadimdemedes)
 */
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import type { ReactElement, ReactNode } from "react";

import type { Variant } from "./variant-config";
import VARIANT_CONFIG from "./variant-config";

export type StatusMessageVariant = Variant;

export type Props = {
    /**
     * Message content.
     */
    readonly children: ReactNode;

    /**
     * Determines the icon and color of the status message.
     */
    readonly variant: StatusMessageVariant;
};

/**
 * Renders a status notification with a colored icon and message text.
 */
export default function StatusMessage({ children, variant }: Props): ReactElement {
    const { color, icon } = VARIANT_CONFIG[variant];

    return (
        <Box gap={1}>
            <Text color={color}>{icon}</Text>
            <Text>{children}</Text>
        </Box>
    );
}

export { StatusMessage };
export type { Props as StatusMessageProps };
