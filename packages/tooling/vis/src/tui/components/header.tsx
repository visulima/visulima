import { Box, Text } from "@visulima/tui";
import type { ReactNode } from "react";

interface HeaderProps {
    children?: ReactNode;
    title: string;
    variant: "error" | "info" | "success";
}

const variantColors: Record<HeaderProps["variant"], string> = {
    error: "red",
    info: "white",
    success: "green",
};

/**
 * Renders the VIS badge + status dot + title header line.
 *
 * Example output: ` VIS `  ●  Running targets build for 3 projects.
 */
const Header = ({ children, title, variant }: HeaderProps): React.JSX.Element => {
    const color = variantColors[variant];

    return (
        <Box flexDirection="column">
            <Box gap={1}>
                <Text bold inverse>
                    {" VIS "}
                </Text>
                <Text bold color={color}>
                    {"\u2022"}
                </Text>
                <Text>{title}</Text>
            </Box>
            {children}
        </Box>
    );
};

export default Header;
