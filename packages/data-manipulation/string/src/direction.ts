/* eslint-disable import/prefer-default-export */

const rtlRange = "\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC";
const ltrRange = "A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF\u200E\u2C00-\uFB1C\uFE00-\uFE6F\uFEFD-\uFFFF";

/* eslint-disable no-misleading-character-class, regexp/no-misleading-unicode-character, regexp/no-obscure-range */
const rtl = new RegExp(`^[^${ltrRange}]*[${rtlRange}]`);
const ltr = new RegExp(`^[^${rtlRange}]*[${ltrRange}]`);
/* eslint-enable no-misleading-character-class, regexp/no-misleading-unicode-character, regexp/no-obscure-range */

/**
 * Detect the direction of text: left-to-right, right-to-left, or neutral.
 * @param value The string to analyze.
 * @returns The text direction: 'rtl' for right-to-left, 'ltr' for left-to-right, or 'neutral' for neutral.
 */
export const direction = (value = ""): "rtl" | "ltr" | "neutral" => {
    const source = value;

    if (rtl.test(source)) {
        return "rtl";
    }

    if (ltr.test(source)) {
        return "ltr";
    }

    return "neutral";
};
