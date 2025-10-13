const globToRegExp = (glob: string): RegExp => {
    const reString = glob
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\.\*/g, ".([^/]*)") // Replace .* with .([^/]*)
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\*\*/g, "(.*)") // Replace ** with (.*)
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/(?<!\.)\*(?!\*)/g, "([^/]*)") // Replace * (not preceded by . or followed by *) with ([^/]*)
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\?/g, "[^/]") // Replace ? with [^/]
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\.(?!\*)/g, String.raw`\.`) // Escape . that is not preceded by *
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\{/g, "(") // Replace { with (
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\}/g, ")") // Replace } with )
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/,/g, "|") // Replace , with |
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\[!(.*?)\]/g, "[^$1]"); // Replace [!number-number] with [^number-number]

    // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
    return new RegExp(`^${reString}$`);
};

export default globToRegExp;
