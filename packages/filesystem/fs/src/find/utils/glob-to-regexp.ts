const globToRegExp = (glob: string): RegExp => {
    const reString = glob
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
        .replace(/\.(?!\*)/g, String.raw`\.`) // Escape . that is not preceded by *
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\{/g, "(") // Replace { with (
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\}/g, ")") // Replace } with )
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/,/g, "|") // Replace , with |
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\[!(.*?)\]/g, "[^$1]"); // Replace [!number-number] with [^number-number]

    try {
        return new RegExp(`^${reString}$`);
    } catch (error) {
        throw new Error(`Invalid glob pattern: ${glob}`, { cause: error });
    }
};

export default globToRegExp;
