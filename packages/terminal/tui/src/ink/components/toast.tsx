/* eslint-disable react/function-component-definition */
import type { ReactElement, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import Box from "./box";
import Text from "./text";
import type { Variant } from "./variant-config";
import VARIANT_CONFIG from "./variant-config";

export type ToastVariant = Variant;

export type Props = {
    /**
     * Toast body.
     */
    readonly children: ReactNode;

    /**
     * Milliseconds to display before auto-dismissing. Use `0` to disable.
     * @default 4000
     */
    readonly duration?: number;

    /**
     * Called after the toast dismisses itself.
     */
    readonly onDismiss?: () => void;

    /**
     * Optional title rendered before the body.
     */
    readonly title?: string;

    /**
     * Visual variant determining the icon and border color.
     * @default "info"
     */
    readonly variant?: ToastVariant;

    /**
     * Manually control visibility. When provided, `duration` is ignored.
     */
    readonly visible?: boolean;

    /**
     * Optional width override.
     */
    readonly width?: number;
};

/**
 * Ephemeral notification. Disappears automatically after `duration` ms.
 * @returns A bordered `ReactElement` while visible; `null` once dismissed.
 */
export default function Toast({ children, duration = 4000, onDismiss, title, variant = "info", visible, width }: Props): ReactElement | null {
    const [internalVisible, setInternalVisible] = useState(true);
    const isVisible = visible ?? internalVisible;
    const onDismissRef = useRef(onDismiss);

    onDismissRef.current = onDismiss;

    useEffect(() => {
        if (visible !== undefined || duration <= 0 || !isVisible) {
            return undefined;
        }

        const timer = setTimeout(() => {
            setInternalVisible(false);
            onDismissRef.current?.();
        }, duration);

        return () => {
            clearTimeout(timer);
        };
    }, [duration, visible, isVisible]);

    if (!isVisible) {
        return null;
    }

    const { color, icon } = VARIANT_CONFIG[variant];

    return (
        <Box borderColor={color} borderStyle="round" gap={1} paddingX={1} width={width}>
            <Text color={color}>{icon}</Text>
            <Box flexDirection="column" flexGrow={1}>
                {title === undefined ? undefined : <Text bold>{title}</Text>}
                <Text>{children}</Text>
            </Box>
        </Box>
    );
}
