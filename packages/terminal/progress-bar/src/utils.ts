import type { MultiBarOptions, ProgressBarOptions, ProgressBarStyle } from "./types";

// Braille characters for pill-shaped progress bars
export const BRAILLE_FULL = "⣿";
export const BRAILLE_CAP_LEFT = "⢾";
export const BRAILLE_CAP_RIGHT = "⡷";
export const BRAILLE_EMPTY = "⠤";

/**
 * Gets the appropriate bar character based on style and completion state.
 * @param char Custom character override
 * @param style Progress bar style to use
 * @param complete Whether to get completed or incomplete character
 * @returns The appropriate character for the given style
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const getBarChar = (char: string | undefined, style: ProgressBarStyle, complete = true): string => {
    if (char) {
        return char;
    }

    switch (style) {
        case "ascii": {
            return complete ? "#" : "-";
        }
        case "braille": {
            return complete ? BRAILLE_FULL : BRAILLE_EMPTY;
        }
        case "filled": {
            return complete ? "█" : " ";
        }
        case "rect": {
            return complete ? "▬" : "▭";
        }
        case "shades_classic": {
            return complete ? "█" : "░";
        }
        case "shades_grey": {
            return complete ? "▓" : "░";
        }
        case "solid": {
            return complete ? "█" : " ";
        }
        default: {
            return complete ? "█" : "░";
        }
    }
};

/**
 * Apply style settings to options, allowing overrides.
 */
export const applyStyleToOptions = <T extends ProgressBarOptions | MultiBarOptions>(options: T): T => {
    if (!options.style) {
        return options;
    }

    const { style } = options;
    const result = { ...options };

    result.barCompleteChar ??= getBarChar(undefined, style, true);
    result.barIncompleteChar ??= getBarChar(undefined, style, false);
    result.barGlue ??= "";

    return result;
};
