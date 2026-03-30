/* eslint-disable react/function-component-definition, unicorn/filename-case */
import type React from "react";

import type { Props as BoxProps } from "../Box";
import Box from "../Box";
import { ScrollBar } from "./ScrollBar";

export interface ScrollBarBoxProps extends BoxProps {
    contentHeight: number;
    viewportHeight: number;
    scrollOffset: number;
    scrollBarPosition?: "left" | "right";
    scrollBarAutoHide?: boolean;
    children?: React.ReactNode;
    thumbChar?: string;
}

const ScrollBarBox = ({
    contentHeight,
    viewportHeight,
    scrollOffset,
    scrollBarPosition = "right",
    scrollBarAutoHide = false,
    borderStyle = "single",
    borderColor,
    borderDimColor,
    borderLeftColor,
    borderRightColor,
    borderLeftDimColor,
    borderRightDimColor,
    height,
    thumbChar,
    children,
    ...boxProps
}: ScrollBarBoxProps): React.JSX.Element => {
    const isLeft = scrollBarPosition === "left";
    const scrollBarPlacement = isLeft ? "left" : "right";
    const scrollBarColor = isLeft ? (borderLeftColor ?? borderColor) : (borderRightColor ?? borderColor);
    const scrollBarDimColor = isLeft ? (borderLeftDimColor ?? borderDimColor) : (borderRightDimColor ?? borderDimColor);

    return (
        <Box flexDirection="row" height={height} {...boxProps}>
            {isLeft && (
                <ScrollBar
                    placement={scrollBarPlacement}
                    style={borderStyle}
                    color={scrollBarColor}
                    dimColor={scrollBarDimColor}
                    contentHeight={contentHeight}
                    viewportHeight={viewportHeight}
                    scrollOffset={scrollOffset}
                    autoHide={scrollBarAutoHide}
                    thumbChar={thumbChar}
                />
            )}
            <Box
                flexGrow={1}
                overflow="hidden"
                borderStyle={borderStyle}
                borderColor={borderColor}
                borderDimColor={borderDimColor}
                borderLeft={!isLeft}
                borderRight={isLeft}
            >
                {children}
            </Box>
            {!isLeft && (
                <ScrollBar
                    placement={scrollBarPlacement}
                    style={borderStyle}
                    color={scrollBarColor}
                    dimColor={scrollBarDimColor}
                    contentHeight={contentHeight}
                    viewportHeight={viewportHeight}
                    scrollOffset={scrollOffset}
                    autoHide={scrollBarAutoHide}
                    thumbChar={thumbChar}
                />
            )}
        </Box>
    );
};

export { ScrollBarBox };
export default ScrollBarBox;
