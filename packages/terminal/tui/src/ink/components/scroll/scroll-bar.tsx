import React, { useMemo } from "react";

import type { Props as BoxProps } from "../box";
import Box from "../box";
import Text from "../text";

type ScrollBarPlacement = "inset" | "left" | "right";

type ScrollBarStyle = BoxProps["borderStyle"] | "block" | "line" | "thick" | "dots";

interface ScrollBarProps {
    autoHide?: boolean;
    color?: string;
    contentHeight: number;
    dimColor?: boolean;
    placement?: ScrollBarPlacement;
    scrollOffset: number;
    style?: ScrollBarStyle;
    thumbChar?: string;
    trackChar?: string;
    viewportHeight: number;
}

const STYLE_CHARS: Record<string, { lowerThumb?: string; thumb: string; track: string; upperThumb?: string }> = {
    arrow: { lowerThumb: "╽", thumb: "┃", track: "|", upperThumb: "╿" },
    block: { thumb: "█", track: "░" },
    bold: { lowerThumb: "╿", thumb: "│", track: "┃", upperThumb: "╽" },
    classic: { thumb: "┃", track: "|" },
    dots: { thumb: "●", track: "·" },
    double: { thumb: "┃", track: "║" },
    doubleSingle: { lowerThumb: "╽", thumb: "┃", track: "│", upperThumb: "╿" },
    line: { thumb: "│", track: " " },
    round: { lowerThumb: "╽", thumb: "┃", track: "│", upperThumb: "╿" },
    single: { lowerThumb: "╽", thumb: "┃", track: "│", upperThumb: "╿" },
    singleDouble: { thumb: "┃", track: "║" },
    thick: { thumb: "┃", track: "╏" },
};

const CORNER_CHARS: Record<string, { bottomLeft: string; bottomRight: string; topLeft: string; topRight: string }> = {
    arrow: { bottomLeft: "└", bottomRight: "┘", topLeft: "┌", topRight: "┐" },
    bold: { bottomLeft: "┗", bottomRight: "┛", topLeft: "┏", topRight: "┓" },
    classic: { bottomLeft: "+", bottomRight: "+", topLeft: "+", topRight: "+" },
    double: { bottomLeft: "╚", bottomRight: "╝", topLeft: "╔", topRight: "╗" },
    doubleSingle: { bottomLeft: "╘", bottomRight: "╛", topLeft: "╒", topRight: "╕" },
    round: { bottomLeft: "╰", bottomRight: "╯", topLeft: "╭", topRight: "╮" },
    single: { bottomLeft: "└", bottomRight: "┘", topLeft: "┌", topRight: "┐" },
    singleDouble: { bottomLeft: "╙", bottomRight: "╜", topLeft: "╓", topRight: "╖" },
};

const getStyleChars = (style: ScrollBarStyle | undefined): { lowerThumb?: string; thumb: string; track: string; upperThumb?: string } => {
    const key = typeof style === "string" ? style : "single";

    return STYLE_CHARS[key] ?? STYLE_CHARS["single"] ?? { thumb: "┃", track: "│" };
};

const getCornerChars = (style: ScrollBarStyle | undefined): { bottomLeft: string; bottomRight: string; topLeft: string; topRight: string } => {
    const key = typeof style === "string" ? style : "single";

    return CORNER_CHARS[key] ?? CORNER_CHARS["single"] ?? { bottomLeft: "└", bottomRight: "┘", topLeft: "┌", topRight: "┐" };
};

const ScrollBar: React.FC<ScrollBarProps> = ({
    autoHide = false,
    color,
    contentHeight,
    dimColor,
    placement = "right",
    scrollOffset,
    style,
    thumbChar,
    trackChar,
    viewportHeight,
}) => {
    const chars = useMemo(() => {
        const effectiveContentHeight = Math.max(contentHeight, viewportHeight);

        if (autoHide && effectiveContentHeight <= viewportHeight) {
            return null;
        }

        const styleChars = getStyleChars(style);
        const resolvedThumbChar = thumbChar ?? styleChars.thumb;
        const resolvedTrackChar = trackChar ?? styleChars.track;

        const totalHalfSteps = viewportHeight * 2;
        const viewportRatio = Math.min(viewportHeight / effectiveContentHeight, 1);
        const thumbLengthHalf = Math.max(2, Math.round(totalHalfSteps * viewportRatio));
        const maxScrollOffset = effectiveContentHeight - viewportHeight;
        const scrollProgress = maxScrollOffset > 0 ? Math.min(Math.max(scrollOffset / maxScrollOffset, 0), 1) : 0;
        const maxThumbStartHalf = totalHalfSteps - thumbLengthHalf;
        const thumbStartHalf = Math.round(scrollProgress * maxThumbStartHalf);
        const thumbEndHalf = thumbStartHalf + thumbLengthHalf;

        const result: string[] = [];

        for (let row = 0; row < viewportHeight; row += 1) {
            const upperHalf = row * 2;
            const lowerHalf = row * 2 + 1;
            const upperIsThumb = upperHalf >= thumbStartHalf && upperHalf < thumbEndHalf;
            const lowerIsThumb = lowerHalf >= thumbStartHalf && lowerHalf < thumbEndHalf;

            if (upperIsThumb && lowerIsThumb) {
                result.push(resolvedThumbChar);
            } else if (upperIsThumb && !lowerIsThumb) {
                result.push(styleChars.lowerThumb ?? resolvedThumbChar);
            } else if (!upperIsThumb && lowerIsThumb) {
                result.push(styleChars.upperThumb ?? resolvedThumbChar);
            } else {
                result.push(resolvedTrackChar);
            }
        }

        return result;
    }, [contentHeight, viewportHeight, scrollOffset, style, thumbChar, trackChar, autoHide]);

    if (chars === null) {
        return null;
    }

    if (placement === "inset") {
        return (
            <Box flexDirection="column" flexShrink={0} width={1}>
                {chars.map((char, index) => (
                    // eslint-disable-next-line react-x/no-array-index-key
                    <Text color={color} dimColor={dimColor} key={index}>
                        {char}
                    </Text>
                ))}
            </Box>
        );
    }

    const cornerChars = getCornerChars(style);
    const topCorner = placement === "left" ? cornerChars.topLeft : cornerChars.topRight;
    const bottomCorner = placement === "left" ? cornerChars.bottomLeft : cornerChars.bottomRight;

    return (
        <Box flexDirection="column" flexShrink={0} width={1}>
            <Text color={color} dimColor={dimColor}>
                {topCorner}
            </Text>
            {chars.map((char, index) => (
                // eslint-disable-next-line react-x/no-array-index-key
                <Text color={color} dimColor={dimColor} key={index}>
                    {char}
                </Text>
            ))}
            <Text color={color} dimColor={dimColor}>
                {bottomCorner}
            </Text>
        </Box>
    );
};

export type { ScrollBarPlacement, ScrollBarProps, ScrollBarStyle };
export { ScrollBar };
export default ScrollBar;
