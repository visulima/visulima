// Translate brace groups (`{a,b}` -> `(a|b)`) in a single pass so that commas
// are only turned into alternations when they sit inside a balanced brace group.
// Commas outside braces are literal, and unmatched braces are escaped so they
// match literally instead of producing an invalid (unbalanced) RegExp.
const convertBraces = (input: string): string => {
    const openStack: number[] = [];
    const matched = new Set<number>();

    for (let index = 0; index < input.length; index++) {
        if (input[index] === "{") {
            openStack.push(index);
        } else if (input[index] === "}") {
            const open = openStack.pop();

            if (open !== undefined) {
                matched.add(open);
                matched.add(index);
            }
        }
    }

    let depth = 0;
    let result = "";

    for (let index = 0; index < input.length; index++) {
        const char = input[index];

        if (char === "{") {
            if (matched.has(index)) {
                result += "(";
                depth++;
            } else {
                result += String.raw`\{`;
            }
        } else if (char === "}") {
            if (matched.has(index)) {
                result += ")";
                depth--;
            } else {
                result += String.raw`\}`;
            }
        } else if (char === "," && depth > 0) {
            result += "|";
        } else {
            result += char;
        }
    }

    return result;
};

const globToRegExp = (glob: string): RegExp => {
    const escaped = glob
        // Escape regex metacharacters that carry no glob meaning here so literal runs
        // (e.g. `a)b`, `foo(`, `a+b`) cannot produce an invalid RegExp.
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/[$()+\\^]/g, String.raw`\$&`)
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\.\*/g, ".([^/]*)") // Replace .* with .([^/]*)
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\*\*/g, "(.*)") // Replace ** with (.*)
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/(?<!\.)\*(?!\*)/g, "([^/]*)") // Replace * (not preceded by . or followed by *) with ([^/]*)
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\?/g, "[^/]") // Replace ? with [^/]
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\.(?!\*)/g, String.raw`\.`); // Escape . that is not preceded by *

    const reString = convertBraces(escaped)
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\[!(.*?)\]/g, "[^$1]"); // Replace [!number-number] with [^number-number]

    try {
        return new RegExp(`^${reString}$`);
    } catch (error) {
        throw new Error(`Invalid glob pattern: ${glob}`, { cause: error });
    }
};

export default globToRegExp;
