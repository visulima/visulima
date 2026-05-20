import { hasAnsiControlCharacters, tokenizeAnsi } from "./ansi-tokenizer";

const sgrParametersRegex = /^[\d:;]*$/;

// OSC 8 (hyperlinks) is the only OSC sequence the renderer needs. Every
// other OSC introducer is stripped so attacker-controlled text cannot
// hijack the terminal title (OSC 0/1/2), write the user's clipboard
// (OSC 52), query/set the palette (OSC 4/10/11), or pop a notification
// (OSC 9). The tokenizer keeps the introducer (`ESC ]` or the C1 OSC
// byte U+009D) at the start of `value`, so we match on the full prefix
// including the trailing `;` to avoid letting OSC 80, 81, … slip through
// on a substring match.
const escOsc8Prefix = "]8;";
const c1Osc8Prefix = "8;";

const isAllowedOsc = (value: string): boolean => value.startsWith(escOsc8Prefix) || value.startsWith(c1Osc8Prefix);

// Strip ANSI escape sequences that would conflict with Ink's layout.
// Preserved: SGR sequences (colors, bold, etc. - end with 'm') and
// OSC 8 hyperlink sequences (ESC ]8 / C1 OSC 8).
// Stripped: cursor movement, screen clearing, non-hyperlink OSC, and other
// control sequences.
const sanitizeAnsi = (text: string): string => {
    if (!hasAnsiControlCharacters(text)) {
        return text;
    }

    let output = "";

    for (const token of tokenizeAnsi(text)) {
        if (token.type === "text") {
            output += token.value;
            continue;
        }

        if (token.type === "osc" && isAllowedOsc(token.value)) {
            output += token.value;
            continue;
        }

        if (token.type === "csi" && token.finalCharacter === "m" && token.intermediateString === "" && sgrParametersRegex.test(token.parameterString)) {
            output += token.value;
        }
    }

    return output;
};

export default sanitizeAnsi;
