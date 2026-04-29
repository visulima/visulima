import { Box, Text } from "@visulima/tui";
import type { ReactNode } from "react";

export type ConfigBannerSeverity = "error" | "warn";

interface ConfigBannerProps {
    children?: ReactNode;
    hint?: string;
    message: string;
    severity: ConfigBannerSeverity;
    title: string;
}

const SEVERITY_COLORS: Record<ConfigBannerSeverity, string> = {
    error: "red",
    warn: "yellow",
};

const SEVERITY_GLYPHS: Record<ConfigBannerSeverity, string> = {
    error: "✖",
    warn: "⚠",
};

const SEVERITY_LABELS: Record<ConfigBannerSeverity, string> = {
    error: " ERROR ",
    warn: " WARN ",
};

/**
 * Top-of-screen banner used by interactive TUIs to surface non-fatal
 * setup issues (e.g. vis-config could not be loaded). Stays out of the
 * scrollable layout so it remains visible while the user navigates.
 */
const ConfigBanner = ({ children, hint, message, severity, title }: ConfigBannerProps): React.JSX.Element => {
    const color = SEVERITY_COLORS[severity];

    return (
        <Box
            borderColor={color}
            borderStyle="single"
            flexDirection="column"
            flexShrink={0}
            paddingX={1}
        >
            <Box gap={1}>
                <Text backgroundColor={color} bold color="black">
                    {SEVERITY_LABELS[severity]}
                </Text>
                <Text bold color={color}>
                    {SEVERITY_GLYPHS[severity]}
                </Text>
                <Text bold wrap="truncate-end">{title}</Text>
            </Box>
            <Text wrap="truncate-end">{message}</Text>
            {hint
                ? (
                    <Text dimColor wrap="truncate-end">{hint}</Text>
                )
                : null}
            {children}
        </Box>
    );
};

export default ConfigBanner;
