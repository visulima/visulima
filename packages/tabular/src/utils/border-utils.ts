import type { BorderComponent, BorderStyle, BorderType } from "../types";

/**
 * Gets the horizontal border components for a specific border type
 * @param border - The border style configuration
 * @param borderType - The type of border (top, middle, or bottom)
 * @returns Object containing left, body, join, and right border components
 */
export const getHorizontalBorderChars = (
    border: BorderStyle,
    borderType: BorderType,
): {
    body: BorderComponent;
    join: BorderComponent;
    left: BorderComponent;
    right: BorderComponent;
} => {
    switch (borderType) {
        case "top": {
            return {
                body: border.topBody,
                join: border.topJoin,
                left: border.topLeft,
                right: border.topRight,
            };
        }
        case "bottom": {
            return {
                body: border.bottomBody,
                join: border.bottomJoin,
                left: border.bottomLeft,
                right: border.bottomRight,
            };
        }
        case "middle": {
            return {
                body: border.joinBody,
                join: border.joinJoin,
                left: border.joinLeft,
                right: border.joinRight,
            };
        }
        // Add a default case to satisfy the compiler, though it shouldn't be reachable
        default: {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            throw new Error(`Invalid borderType: ${borderType}`);
        }
    }
};

/**
 * Gets the vertical border components
 * @param border - The border style configuration
 * @returns Object containing left, join, and right border components
 */
export const getVerticalBorderChars = (
    border: BorderStyle,
): {
    join: BorderComponent;
    left: BorderComponent;
    right: BorderComponent;
} => {
    return {
        join: border.bodyJoin,
        left: border.bodyLeft,
        right: border.bodyRight,
    };
};
