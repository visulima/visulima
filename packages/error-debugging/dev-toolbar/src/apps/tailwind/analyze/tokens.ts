/** Token shapes, and the routing of theme variables into them. Moved unchanged. */
// ─── Token types ──────────────────────────────────────────────────────────────

export interface ColorToken {
    cssVar: string;
    name: string;
    value: string;
}

export interface SpacingToken {
    cssVar: string;
    name: string;
    numericPx: number;
    value: string;
}

export interface FontSizeToken {
    cssVar: string;
    name: string;
    sizePx: number;
    value: string;
}

export interface EffectToken {
    cssVar: string;
    name: string;
    value: string;
}

export interface TokenSet {
    colors: ColorToken[];
    fontFamilies: EffectToken[];
    fontSizes: FontSizeToken[];
    radii: EffectToken[];
    shadows: EffectToken[];
    spacing: SpacingToken[];
}
// ─── Token extraction ─────────────────────────────────────────────────────────

export const parseToPx = (value: string): number => {
    if (value.endsWith("rem")) {
        return Number.parseFloat(value) * 16;
    }

    if (value.endsWith("px")) {
        return Number.parseFloat(value);
    }

    if (value.endsWith("em")) {
        return Number.parseFloat(value) * 16;
    }

    return 0;
};

export const extractTokens = (variables: Map<string, string>): TokenSet => {
    const colors: ColorToken[] = [];
    const spacing: SpacingToken[] = [];
    const fontSizes: FontSizeToken[] = [];
    const fontFamilies: EffectToken[] = [];
    const radii: EffectToken[] = [];
    const shadows: EffectToken[] = [];

    for (const [prop, value] of variables) {
        if (prop.startsWith("--color-")) {
            colors.push({ cssVar: prop, name: prop.slice(8), value });
        } else if (prop.startsWith("--spacing-")) {
            spacing.push({
                cssVar: prop,
                name: prop.slice(10),
                numericPx: parseToPx(value),
                value,
            });
        } else if (prop.startsWith("--text-") && !prop.includes("--line-height") && !prop.endsWith("--font-weight")) {
            fontSizes.push({
                cssVar: prop,
                name: prop.slice(7),
                sizePx: parseToPx(value),
                value,
            });
        } else if (prop.startsWith("--font-")) {
            fontFamilies.push({ cssVar: prop, name: prop.slice(7), value });
        } else if (prop.startsWith("--radius-")) {
            radii.push({ cssVar: prop, name: prop.slice(9), value });
        } else if (prop.startsWith("--shadow-") || prop.startsWith("--drop-shadow-")) {
            shadows.push({ cssVar: prop, name: prop.slice(2), value });
        }
    }

    const sortedSpacing = spacing.toSorted((a, b) => a.numericPx - b.numericPx);
    const sortedFontSizes = fontSizes.toSorted((a, b) => a.sizePx - b.sizePx);

    return { colors, fontFamilies, fontSizes: sortedFontSizes, radii, shadows, spacing: sortedSpacing };
};
