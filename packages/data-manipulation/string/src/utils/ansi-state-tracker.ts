/**
 * Matches a complete SGR sequence and captures its parameter list.
 *
 * Only `CSI ... m` is SGR. Cursor movement and friends (`CSI 1 D`) carry no style and must fall
 * through untouched, so the terminator is part of the pattern rather than an afterthought.
 */
// eslint-disable-next-line no-control-regex
const RE_SGR_SEQUENCE = /^(?:\u001B\[|\u009B)([\d:;]*)m$/;

/**
 * Attribute-setting parameters mapped to the parameter that turns them off.
 *
 * Several attributes share a reset (`1` bold and `2` dim are both cleared by `22`; `4` underline
 * and `21` double-underline by `24`), which is why active attributes are keyed by their reset code:
 * storing `1` then `2` must leave one entry, and a later `22` must clear it.
 */
const ATTRIBUTE_RESETS: ReadonlyMap<number, number> = new Map([
    [1, 22],
    [2, 22],
    [3, 23],
    [4, 24],
    [5, 25],
    [6, 25],
    [7, 27],
    [8, 28],
    [9, 29],
    [21, 24],
    [53, 55],
]);

/** Parameters that clear an attribute. These are exactly the values of {@link ATTRIBUTE_RESETS}. */
const ATTRIBUTE_RESET_PARAMETERS: ReadonlySet<number> = new Set(ATTRIBUTE_RESETS.values());

/**
 * Splits an SGR parameter list into one entry per attribute.
 *
 * The extended-colour introducers `38`/`48`/`58` swallow the parameters that follow them — two more
 * for `5;&lt;index>`, four more for `2;&lt;r>;&lt;g>;&lt;b>` — so a naive `split(";")` turns one truecolour
 * attribute into five nonsense ones. The ITU sub-parameter spelling (`38:2::r:g:b`) already arrives
 * as a single token and is passed through whole.
 * @param parameters The raw parameter text between `CSI` and `m`.
 * @returns One token group per attribute, in the order they appeared.
 */
const splitSgrParameters = (parameters: string): string[][] => {
    const tokens = parameters.split(";");
    const operations: string[][] = [];

    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index] as string;

        if (token.includes(":")) {
            operations.push([token]);

            continue;
        }

        const code = token === "" ? 0 : Number.parseInt(token, 10);

        if (code === 38 || code === 48 || code === 58) {
            const selector = tokens[index + 1];
            let consumed = 0;

            if (selector === "5") {
                consumed = 2;
            } else if (selector === "2") {
                consumed = 4;
            } else if (selector?.includes(":")) {
                // Mixed spelling, `38;2:255:0:0`: the whole colour rides in the next token.
                consumed = 1;
            }

            operations.push(tokens.slice(index, index + 1 + consumed));
            index += consumed;

            continue;
        }

        operations.push([token]);
    }

    return operations;
};

/**
 * Reads the leading numeric parameter of an attribute group.
 * @param operation One token group from {@link splitSgrParameters}.
 * @returns The parameter number; an omitted parameter defaults to 0 per ECMA-48.
 */
const leadingParameter = (operation: string[]): number => {
    const first = operation[0] as string;
    const colon = first.indexOf(":");
    const head = colon === -1 ? first : first.slice(0, colon);

    return head === "" ? 0 : Number.parseInt(head, 10);
};

/** Reports whether a parameter selects a foreground colour (basic, bright, or extended). */
const isForegroundParameter = (code: number): boolean => code === 38 || (code >= 30 && code <= 37) || (code >= 90 && code <= 97);

/** Reports whether a parameter selects a background colour (basic, bright, or extended). */
const isBackgroundParameter = (code: number): boolean => code === 48 || (code >= 40 && code <= 47) || (code >= 100 && code <= 107);

/**
 * Classifies a sequence that sets exactly one colour and nothing else.
 *
 * Shared with `slice.ts`, which stores whole sequences and swaps them as units: it can replace "the
 * active foreground" but cannot take the `31` out of a `CSI 1;31 m` and keep the `1`. Classifying a
 * compound sequence would therefore let a later `39m` delete the bold along with the colour, so
 * anything carrying more than one attribute stays unclassified and is treated as an opaque style.
 *
 * Working from parsed parameters rather than the raw text also avoids the traps in the string form:
 * `"1001"` sorts inside `"100".."107"` yet is not a colour, and the sub-parameter spelling
 * `"38:2::10:20:30"` does not start with `"38;"`.
 * @param parameters The raw parameter text between `CSI` and `m`.
 * @returns The slot the sequence writes to, or `undefined` when it sets no colour or sets more than one attribute.
 */
const sgrColorTarget = (parameters: string): "background" | "foreground" | undefined => {
    const operations = splitSgrParameters(parameters);

    if (operations.length !== 1) {
        return undefined;
    }

    const code = leadingParameter(operations[0] as string[]);

    if (isForegroundParameter(code)) {
        return "foreground";
    }

    return isBackgroundParameter(code) ? "background" : undefined;
};

/**
 * Tracks ANSI SGR state so styling can be closed at a line break and reopened on the next line.
 *
 * Handles the full parameter grammar: compound sequences (`CSI 1;31 m`), 256-colour
 * (`CSI 38;5;n m`) and truecolour (`CSI 38;2;r;g;b m`), including the `48`/`58` background and
 * underline-colour forms. Anything it cannot classify is ignored rather than guessed at.
 */
class AnsiStateTracker {
    private activeForeground: string | undefined = undefined;

    private activeBackground: string | undefined = undefined;

    private activeUnderlineColor: string | undefined = undefined;

    /** Active attributes keyed by the parameter that turns each one off, in the order they opened. */
    private readonly activeAttributes = new Map<number, string>();

    /**
     * Processes an escape sequence and updates the internal state.
     * @param sequence The escape sequence to process. Non-SGR sequences are ignored.
     */
    public processEscape(sequence: string): void {
        const match = RE_SGR_SEQUENCE.exec(sequence);

        if (!match) {
            return;
        }

        for (const operation of splitSgrParameters(match[1] as string)) {
            const code = leadingParameter(operation);

            switch (code) {
                case 0: {
                    this.resetAll();

                    break;
                }
                case 39: {
                    this.activeForeground = undefined;

                    break;
                }
                case 49: {
                    this.activeBackground = undefined;

                    break;
                }
                case 59: {
                    this.activeUnderlineColor = undefined;

                    break;
                }
                default: {
                    this.applyParameter(code, `\u001B[${operation.join(";")}m`);
                }
            }
        }
    }

    /**
     * Gets all active escape sequences to apply.
     * @returns String with all active escapes
     */
    public getStartEscapesForAllActiveAttributes(): string {
        return [this.activeBackground, this.activeForeground, this.activeUnderlineColor, ...this.activeAttributes.values()].filter(Boolean).join("");
    }

    /**
     * Gets all closing escape sequences for the currently active attributes.
     * The order is the reverse of application: attributes, then foreground, then background.
     * @returns String with all necessary closing escapes.
     */
    public getEndEscapesForAllActiveAttributes(): string {
        const closingEscapes: string[] = [...this.activeAttributes.keys()].toReversed().map((reset) => `\u001B[${String(reset)}m`);

        if (this.activeUnderlineColor) {
            closingEscapes.push("\u001B[59m");
        }

        if (this.activeForeground) {
            closingEscapes.push("\u001B[39m");
        }

        if (this.activeBackground) {
            closingEscapes.push("\u001B[49m");
        }

        return closingEscapes.join("");
    }

    /** Clears every tracked attribute, as `SGR 0` does. */
    private resetAll(): void {
        this.activeForeground = undefined;
        this.activeBackground = undefined;
        this.activeUnderlineColor = undefined;
        this.activeAttributes.clear();
    }

    /**
     * Applies one parsed attribute to the tracked state.
     * @param code The leading parameter of the attribute.
     * @param rendered The attribute re-rendered as a standalone sequence, ready to reopen with.
     */
    private applyParameter(code: number, rendered: string): void {
        if ((code === 38 || code === 48 || code === 58) && !rendered.includes(";") && !rendered.includes(":")) {
            // A bare introducer carries no colour to reopen. Storing it would re-emit a malformed
            // `CSI 38 m` at the start of every continuation line.
            return;
        }

        if (isForegroundParameter(code)) {
            this.activeForeground = rendered;
        } else if (isBackgroundParameter(code)) {
            this.activeBackground = rendered;
        } else if (code === 58) {
            this.activeUnderlineColor = rendered;
        } else if (ATTRIBUTE_RESET_PARAMETERS.has(code)) {
            this.activeAttributes.delete(code);
        } else {
            const reset = ATTRIBUTE_RESETS.get(code);

            if (reset !== undefined) {
                // Keyed by the reset parameter, so reopening an already-active attribute replaces
                // it in place instead of stacking a second copy that would need a second close.
                this.activeAttributes.set(reset, rendered);
            }
        }
    }
}

export default AnsiStateTracker;
export { sgrColorTarget };
