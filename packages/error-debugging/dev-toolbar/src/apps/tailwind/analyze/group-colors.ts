/** Splits colour tokens into numeric scales and one-off semantic colours. */
import type { ColorToken } from "./tokens";

const NUMERIC_SCALE_RE = /^\w+-\d+$/;

/** Also used by the config tab, which groups the server-side theme the same way. */
export const TRAILING_NUMBER_RE = /-\d+$/;

export const TRAILING_NUMBER_CAPTURE_RE = /-(\d+)$/;

// ─── Color grouping ───────────────────────────────────────────────────────────

export const isNumericScale = (name: string): boolean => NUMERIC_SCALE_RE.test(name);

export const groupColors = (colors: ColorToken[]): { scales: Map<string, ColorToken[]>; semantic: ColorToken[] } => {
    const semantic: ColorToken[] = [];
    const scaleMap = new Map<string, ColorToken[]>();

    for (const token of colors) {
        if (isNumericScale(token.name)) {
            const scaleName = token.name.replace(TRAILING_NUMBER_RE, "");
            const existing = scaleMap.get(scaleName) ?? [];

            existing.push(token);
            scaleMap.set(scaleName, existing);
        } else {
            semantic.push(token);
        }
    }

    for (const [key, tokens] of scaleMap) {
        scaleMap.set(
            key,
            tokens.toSorted((a, b) => {
                const numberA = Number.parseInt(a.name.match(TRAILING_NUMBER_CAPTURE_RE)?.[1] ?? "0", 10);
                const numberB = Number.parseInt(b.name.match(TRAILING_NUMBER_CAPTURE_RE)?.[1] ?? "0", 10);

                return numberA - numberB;
            }),
        );
    }

    return { scales: scaleMap, semantic };
};
