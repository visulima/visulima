import type React from "react";

import type { Props as BoxProps } from "../box";
import Box from "../box";
import { ScrollBar } from "./scroll-bar";

interface ScrollBarBoxProps extends BoxProps {
    children?: React.ReactNode;
    contentHeight: number;
    scrollBarAutoHide?: boolean;
    scrollBarPosition?: "left" | "right";
    scrollOffset: number;
    thumbChar?: string;
    viewportHeight: number;
}

const ScrollBarBox = ({
    borderColor,
    borderDimColor,
    borderLeftColor,
    borderLeftDimColor,
    borderRightColor,
    borderRightDimColor,
    borderStyle = "single",
    children,
    contentHeight,
    height,
    scrollBarAutoHide = false,
    scrollBarPosition = "right",
    scrollOffset,
    thumbChar,
    viewportHeight,
    ...boxProps
}: ScrollBarBoxProps): React.JSX.Element => {
    const isLeft = scrollBarPosition === "left";
    const scrollBarPlacement = isLeft ? "left" : "right";
    const scrollBarColor = isLeft ? borderLeftColor ?? borderColor : borderRightColor ?? borderColor;
    const scrollBarDimColor = isLeft ? borderLeftDimColor ?? borderDimColor : borderRightDimColor ?? borderDimColor;

    return (
        <Box flexDirection="row" height={height} {...boxProps}>
            {isLeft && (
                <ScrollBar
                    autoHide={scrollBarAutoHide}
                    color={scrollBarColor}
                    contentHeight={contentHeight}
                    dimColor={scrollBarDimColor}
                    placement={scrollBarPlacement}
                    scrollOffset={scrollOffset}
                    style={borderStyle}
                    thumbChar={thumbChar}
                    viewportHeight={viewportHeight}
                />
            )}
            <Box
                borderColor={borderColor}
                borderDimColor={borderDimColor}
                borderLeft={!isLeft}
                borderRight={isLeft}
                borderStyle={borderStyle}
                flexGrow={1}
                overflow="hidden"
            >
                {children}
            </Box>
            {!isLeft && (
                <ScrollBar
                    autoHide={scrollBarAutoHide}
                    color={scrollBarColor}
                    contentHeight={contentHeight}
                    dimColor={scrollBarDimColor}
                    placement={scrollBarPlacement}
                    scrollOffset={scrollOffset}
                    style={borderStyle}
                    thumbChar={thumbChar}
                    viewportHeight={viewportHeight}
                />
            )}
        </Box>
    );
};

export type { ScrollBarBoxProps };

export { ScrollBarBox };
export default ScrollBarBox;
