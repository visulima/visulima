/**
 * Commands whose effect outlives their own segment: they change the working
 * directory, shell options, or environment that later segments inherit. A
 * chain that uses one of them is left whole.
 */
const STATEFUL_COMMANDS: ReadonlySet<string> = new Set([
    ".",
    "alias",
    "cd",
    "declare",
    "eval",
    "exec",
    "export",
    "hash",
    "local",
    "popd",
    "pushd",
    "readonly",
    "set",
    "shopt",
    "source",
    "trap",
    "typeset",
    "ulimit",
    "umask",
    "unalias",
    "unset",
]);

const ASSIGNMENT_WORD = /^[A-Z_]\w*=/i;

export interface CompoundSplit {
    /**
     * Set when the command has a top-level `&amp;&amp;` but was left whole because
     * a construct the splitter does not model appears somewhere in it.
     */
    refusedReason?: string;

    /** Top-level `&amp;&amp;` segments in order, each trimmed. `[command]` when not split. */
    segments: string[];
}

interface QuoteMasks {
    /** Not inside single quotes and not escaped: substitution (`$(`, backticks) is active here. */
    live: boolean[];
    /** Set when a quote is still open at the end of the command. */
    unbalanced: boolean;
    /** Not inside any quote and not escaped: operators here are real shell operators. */
    unquoted: boolean[];
}

/**
 * Marks which characters are shell-active. POSIX rules: a backslash escapes
 * the next character outside single quotes; single quotes are fully literal;
 * double quotes are literal except for `$(`, backticks and escapes.
 */
const maskQuoting = (command: string): QuoteMasks => {
    const live: boolean[] = [];
    const unquoted: boolean[] = [];
    let quote: "\"" | "'" | undefined;

    const push = (isLive: boolean, isUnquoted: boolean): void => {
        live.push(isLive);
        unquoted.push(isUnquoted);
    };

    for (let index = 0; index < command.length; index += 1) {
        const char = command.charAt(index);

        if (quote === "'") {
            push(false, false);

            if (char === "'") {
                quote = undefined;
            }
        } else if (char === "\\") {
            push(false, false);

            if (index + 1 < command.length) {
                index += 1;
                push(false, false);
            }
        } else if (quote === "\"") {
            push(true, false);

            if (char === "\"") {
                quote = undefined;
            }
        } else if (char === "\"" || char === "'") {
            quote = char;
            push(true, false);
        } else {
            push(true, true);
        }
    }

    return { live, unbalanced: quote !== undefined, unquoted };
};

/**
 * Returns the first construct that makes splitting unsafe, or `undefined`.
 * Each of these changes how a `&amp;&amp;` chain would be read if it were cut at
 * `&amp;&amp;`, so the whole command must stay together.
 */
const findUnsupportedConstruct = (command: string, { live, unquoted }: QuoteMasks): string | undefined => {
    for (let index = 0; index < command.length; index += 1) {
        const char = command.charAt(index);
        const next = command.charAt(index + 1);

        if (live[index] && (char === "`" || (char === "$" && (next === "(" || next === "'")))) {
            return "command substitution";
        }

        if (!unquoted[index]) {
            continue;
        }

        if (char === "&") {
            if (next === "&") {
                // The chain operator itself; the boundary pass consumes it.
                index += 1;

                continue;
            }

            // `2>&1` and `&>file` are redirections, not background jobs.
            if (command.charAt(index - 1) === ">" || next === ">") {
                continue;
            }

            return "background `&`";
        }

        if (char === "|" && next === "|") {
            return "`||`";
        }

        if (char === ";" || char === "\n" || char === "\r") {
            return "`;` or newline";
        }

        if (char === "(" || char === ")") {
            return "subshell `( … )`";
        }

        if (char === "<" && next === "<") {
            return "heredoc";
        }

        if (char === "#") {
            return "comment `#`";
        }

        if (char === "^") {
            return "cmd escape `^`";
        }
    }

    return undefined;
};

/**
 * Finds the first word at the start of each pipeline stage inside a
 * segment and returns the reason it changes shell state, if any.
 */
const findStatefulWord = (command: string, unquoted: boolean[], start: number, end: number): string | undefined => {
    const stageStarts = [start];

    for (let index = start; index < end; index += 1) {
        if (unquoted[index] && command.charAt(index) === "|") {
            stageStarts.push(index + 1);
        }
    }

    for (const stageStart of stageStarts) {
        let wordStart = stageStart;

        while (wordStart < end && /\s/.test(command.charAt(wordStart))) {
            wordStart += 1;
        }

        let wordEnd = wordStart;

        while (wordEnd < end && !(unquoted[wordEnd] && /\s/.test(command.charAt(wordEnd)))) {
            wordEnd += 1;
        }

        // Quotes and escapes are stripped before comparing so `"cd"` and `c\d` are still caught.
        const word = command.slice(wordStart, wordEnd).replaceAll(/["'\\]/g, "");

        if (word === "") {
            continue;
        }

        if (ASSIGNMENT_WORD.test(word)) {
            return `\`${word.slice(0, word.indexOf("="))}=\` variable prefix`;
        }

        if (STATEFUL_COMMANDS.has(word)) {
            return `\`${word}\``;
        }
    }

    return undefined;
};

/**
 * Splits a shell command on top-level `&amp;&amp;` so each segment can be cached on
 * its own. Quote-aware: `&amp;&amp;` inside single or double quotes, after a
 * backslash, or inside `$(…)` / backticks is not a boundary.
 *
 * The split is refused, and the command is returned whole with
 * `refusedReason`, when it contains anything this splitter does not model:
 * `;`, `||`, a background `&amp;`, subshells, command substitution, heredocs,
 * comments, `^`, an empty segment (`a &amp;&amp;`, `&amp;& a`), or a segment that starts
 * with a state-changing word (`cd`, `export`, `VAR=value`, `source`, `.`,
 * `set`, `trap`, `exec`, …) at a command or pipeline position.
 *
 * Pipes stay inside their segment: `a | b &amp;& c` splits into `a | b` and `c`.
 * Redirections such as `2>&amp;1` are kept as-is.
 */
export const splitCompoundCommand = (command: string): CompoundSplit => {
    const masks = maskQuoting(command);

    // An open quote means the real quoting is ambiguous, so any `&&` in the
    // text may or may not be a boundary: keep the command whole.
    if (masks.unbalanced && command.includes("&&")) {
        return { refusedReason: "unbalanced quote", segments: [command] };
    }

    const ranges: [number, number][] = [];
    let rangeStart = 0;

    for (let index = 0; index < command.length; index += 1) {
        if (masks.unquoted[index] && command.charAt(index) === "&" && command.charAt(index + 1) === "&") {
            ranges.push([rangeStart, index]);
            rangeStart = index + 2;
            index += 1;
        }
    }

    // No top-level `&&`: nothing to split, so nothing to refuse.
    if (ranges.length === 0) {
        return { segments: [command] };
    }

    const unsupported = findUnsupportedConstruct(command, masks);

    if (unsupported !== undefined) {
        return { refusedReason: unsupported, segments: [command] };
    }

    ranges.push([rangeStart, command.length]);

    const segments = ranges.map(([start, end]) => command.slice(start, end).trim());

    if (segments.includes("")) {
        return { refusedReason: "empty segment", segments: [command] };
    }

    for (const [start, end] of ranges) {
        const statefulWord = findStatefulWord(command, masks.unquoted, start, end);

        if (statefulWord !== undefined) {
            return { refusedReason: statefulWord, segments: [command] };
        }
    }

    return { segments };
};
