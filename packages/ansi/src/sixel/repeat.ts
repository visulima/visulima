export interface DecodedSixelRepeatCommand {
    charToRepeat: string;
    count: number;
}

/**
 * Parses a Sixel repeat command string (e.g., "!10?").
 * @param sixelData The full Sixel data string.
 * @param currentPosition The current parsing position in sixelData (points to '!').
 * @returns An object with the decoded repeat command and the number of characters consumed, or null if invalid.
 */
export const decodeSixelRepeat = (sixelData: string, currentPosition: number): { cmd: DecodedSixelRepeatCommand; consumed: number } | null => {
    let pos = currentPosition;

    if (sixelData[pos] !== "!") {
        return null;
    }

    pos += 1; // Consume '!'

    let countString = "";

    while (pos < sixelData.length && (sixelData[pos] as string) >= "0" && (sixelData[pos] as string) <= "9") {
        countString += sixelData[pos];
        pos += 1;
    }

    let count: number;

    if (countString === "") {
        count = 1; // No digits found after '!', count defaults to 1
    } else {
        count = Number.parseInt(countString, 10);

        if (Number.isNaN(count)) {
            // This case implies non-digits were encountered where count was expected (e.g., "!abc?")
            // Or an empty string somehow passed (though current loop prevents empty countStr if digits were present)
            return null; // Invalid number string for count
        }

        if (count === 0) {
            count = 1; // Count of 0 explicitly defaults to 1
        }

        if (count < 0) {
            return null; // Negative counts are invalid
        }
    }

    if (pos >= sixelData.length) {
        return null; // No character available to repeat
    }

    const charToRepeat = sixelData[pos] as string;
    const charCode = charToRepeat.charCodeAt(0);

    // Ch must be a Sixel data character: '?’ (63) to '~' (126) inclusive.
    if (charCode >= 63 && charCode <= 126) {
        pos += 1; // Consume the character to be repeated

        return { cmd: { charToRepeat, count }, consumed: pos - currentPosition };
    }

    return null; // Character to repeat is not a valid Sixel data character
};
