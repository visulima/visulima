const NUMBER_CHAR_RE = /\d/;

export function isUppercase(char = ""): boolean | undefined {
    if (NUMBER_CHAR_RE.test(char)) {
        return undefined;
    }
    
    return char === char.toUpperCase();
}
