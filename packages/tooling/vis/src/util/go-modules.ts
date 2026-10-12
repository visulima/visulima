/**
 * Read `go.mod` and `go.work` as text. Only the directives vis needs: the module
 * path and the `use` entries. Nothing shells out to `go`.
 * Reference: https://go.dev/ref/mod (go.mod and go.work file sections).
 */

const stripComment = (line: string): string => {
    const index = line.indexOf("//");

    return (index === -1 ? line : line.slice(0, index)).trim();
};

const unquote = (token: string): string => (/^["`].*["`]$/u.test(token) ? token.slice(1, -1) : token);

/** The module path from the `module` directive, or undefined when there is none. */
export const parseGoModModulePath = (raw: string): string | undefined => {
    for (const line of raw.split(/\r?\n/u)) {
        const match = /^\s*module\s+(\S.*)$/u.exec(stripComment(line));

        if (match?.[1] !== undefined) {
            return unquote(match[1].trim());
        }
    }

    return undefined;
};

/** The `use` entries of a go.work file, in order. Block and single-line forms are both read. */
export const parseGoWorkUses = (raw: string): string[] => {
    const uses: string[] = [];
    let inBlock = false;

    for (const line of raw.split(/\r?\n/u)) {
        const text = stripComment(line);

        if (text === "") {
            continue;
        }

        if (inBlock) {
            if (text === ")") {
                inBlock = false;
            } else {
                uses.push(unquote(text));
            }

            continue;
        }

        const match = /^use\s+(.*)$/u.exec(text);

        if (match?.[1] === "(") {
            inBlock = true;
        } else if (match?.[1] !== undefined) {
            uses.push(unquote(match[1].trim()));
        }
    }

    return uses;
};
