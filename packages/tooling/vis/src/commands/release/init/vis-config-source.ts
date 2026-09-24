/**
 * Structural reader for the root `vis.config.ts` object literal.
 *
 * `vis release init` needs two facts about an existing config: where the
 * config object's body starts — so the generated `release` block can be
 * injected as its first property — and whether that object *already* declares
 * a root-level `release` property, which the run must then leave alone.
 *
 * A textual `/\brelease\s*:/` answers neither question. It fires on a comment
 * (`// release: TODO`), on a string (`"release: prod"`), and on a `release:`
 * nested inside some other object — and a false hit there is not cosmetic.
 * It makes the migration record a *non-blocking* skip, which tells `--cutover`
 * the repo already has a usable release config, and every `.releaserc.*` is
 * deleted on that basis. That is the destruction issue #862 was filed about,
 * one level down.
 *
 * So the source is tokenised instead: comments and literal bodies are blanked
 * out (offsets preserved, so every index maps straight back onto the original
 * text), brace depth is tracked from the config object's opening `{`, and only
 * a `release` key sitting directly in that body counts.
 *
 * This is a lexer, not a parser — enough to tell code from not-code, which is
 * all the two questions need. Anything it cannot make sense of (an
 * unterminated object) is reported rather than guessed at, and the caller
 * treats that as blocking.
 */

/** The anchors `vis release init` knows how to inject into. Matched against masked source. */
const CONFIG_ANCHORS: ReadonlyArray<RegExp> = [/defineConfig\s*\(\s*\{/, /export\s+default\s+\{/];

/**
 * Characters after which a `/` opens a regular expression rather than a
 * division. Anything else (an identifier, a digit, a closing paren/bracket)
 * means the `/` divides, so the rest of the line is ordinary code.
 */
const REGEX_ALLOWED_AFTER: ReadonlySet<string> = new Set([
    "",
    "!",
    "%",
    "&",
    "(",
    "*",
    "+",
    ",",
    "-",
    ":",
    ";",
    "<",
    "=",
    ">",
    "?",
    "[",
    "^",
    "{",
    "|",
    "}",
    "~",
]);

type ScanMode = "block-comment" | "code" | "line-comment" | "regex-class" | "regex" | "string" | "template";

/**
 * Blank out every comment body and literal body in `source`, one character in
 * for one character out so offsets keep pointing at the original text.
 *
 * String delimiters are *kept* — a quoted key (`"release":`) has to stay
 * recognisable as a key, and its name is read back out of the original source
 * at the recorded offsets. Everything between them goes, so a value like
 * `"release: prod"` cannot be mistaken for one.
 *
 * Newlines survive masking so a masked offset still lands on the same line as
 * the original, which keeps any future line-based reporting honest.
 */
const maskLiteralsAndComments = (source: string): string => {
    const out: string[] = Array.from<string>({ length: source.length });
    /** Brace depth inside each `${ … }` currently open, innermost last. */
    const interpolations: number[] = [];
    let mode: ScanMode = "code";
    let quote = "";
    /** Last significant *code* character emitted — decides `/` regex vs division. */
    let previous = "";
    let index = 0;

    const emit = (at: number, keep: boolean): void => {
        const char = source[at] as string;

        out[at] = keep || char === "\n" ? char : " ";

        if (keep && char.trim() !== "") {
            previous = char;
        }
    };

    /** Blank an escape pair (`\x`) in one step so the escaped char cannot close the literal. */
    const emitEscape = (): void => {
        emit(index, false);

        if (index + 1 < source.length) {
            emit(index + 1, false);
        }

        index += 2;
    };

    while (index < source.length) {
        const char = source[index] as string;
        const next = source[index + 1];

        if (mode === "code") {
            if (char === "/" && next === "/") {
                emit(index, false);
                emit(index + 1, false);
                index += 2;
                mode = "line-comment";
            } else if (char === "/" && next === "*") {
                emit(index, false);
                emit(index + 1, false);
                index += 2;
                mode = "block-comment";
            } else if (char === "\"" || char === "'") {
                quote = char;
                // The delimiter stays visible so a quoted key is still a key.
                emit(index, true);
                index += 1;
                mode = "string";
            } else if (char === "`") {
                emit(index, false);
                index += 1;
                mode = "template";
            } else if (char === "/" && REGEX_ALLOWED_AFTER.has(previous)) {
                emit(index, false);
                index += 1;
                mode = "regex";
            } else if (interpolations.length > 0 && char === "}" && (interpolations.at(-1) as number) === 0) {
                // Closes the `${` this frame opened. Both braces are blanked,
                // so the interpolation contributes nothing to brace depth.
                interpolations.pop();
                emit(index, false);
                index += 1;
                mode = "template";
            } else {
                if (interpolations.length > 0 && (char === "{" || char === "}")) {
                    interpolations[interpolations.length - 1] = (interpolations.at(-1) as number) + (char === "{" ? 1 : -1);
                }

                emit(index, true);
                index += 1;
            }

            continue;
        }

        if (mode === "line-comment") {
            emit(index, false);
            index += 1;

            if (char === "\n") {
                mode = "code";
            }

            continue;
        }

        if (mode === "block-comment") {
            emit(index, false);

            if (char === "*" && next === "/") {
                emit(index + 1, false);
                index += 2;
                mode = "code";
            } else {
                index += 1;
            }

            continue;
        }

        if (mode === "string") {
            if (char === "\\") {
                emitEscape();

                continue;
            }

            // An unterminated string ends at the newline, the way a JS lexer
            // would stop rather than swallowing the rest of the file.
            if (char === quote || char === "\n") {
                emit(index, char === quote);
                index += 1;
                mode = "code";

                continue;
            }

            emit(index, false);
            index += 1;

            continue;
        }

        if (mode === "template") {
            if (char === "\\") {
                emitEscape();

                continue;
            }

            emit(index, false);

            if (char === "`") {
                index += 1;
                mode = "code";
            } else if (char === "$" && next === "{") {
                // `${` opens real code again; blank both braces so the frame
                // is depth-neutral, then scan its body as code.
                emit(index + 1, false);
                interpolations.push(0);
                index += 2;
                mode = "code";
            } else {
                index += 1;
            }

            continue;
        }

        if (char === "\\") {
            emitEscape();

            continue;
        }

        emit(index, false);
        index += 1;

        if (char === "\n") {
            // An unterminated regex literal: bail rather than mask the rest of the file.
            mode = "code";
        } else if (mode === "regex" && char === "[") {
            mode = "regex-class";
        } else if (mode === "regex" && char === "/") {
            mode = "code";
        } else if (mode === "regex-class" && char === "]") {
            mode = "regex";
        }
    }

    return out.join("");
};

/** Sticky matchers for the depth-1 key scan. */
const IDENTIFIER = /[A-Z_$][\w$]*/iy;
const KEY_TERMINATOR = /\s*[:(,}]/y;

/**
 * `true` when the token that starts at `at` is followed by something that
 * makes it a property key: `:` (a normal property), `(` (a method), or `,`/`}`
 * (an ES2015 shorthand property).
 */
const isKeyPosition = (masked: string, at: number): boolean => {
    KEY_TERMINATOR.lastIndex = at;

    return KEY_TERMINATOR.test(masked);
};

export type VisConfigScan
    /** The config object was located. */
    = | { bodyStart: number; hasReleaseKey: boolean; kind: "found" }
    /** No `defineConfig({` / `export default {` to inject into. */
        | { kind: "no-anchor" }
    /** An anchor was found but its object literal never closes. */
        | { kind: "unterminated" };

/**
 * Locate the config object in a `vis.config.ts` source and report whether it
 * already declares a root-level `release` property.
 *
 * `bodyStart` is the offset immediately after the object's opening `{`, in the
 * original* source — masking preserves offsets — so injecting the generated
 * block is a plain slice-and-splice at that index.
 */
export const scanVisConfigSource = (source: string): VisConfigScan => {
    const masked = maskLiteralsAndComments(source);

    let bodyStart: number | undefined;

    // First anchor wins, in declaration order: a `defineConfig({` is the
    // canonical form, and `export default {` is the fallback the generated
    // configs never use but hand-written ones sometimes do.
    for (const anchor of CONFIG_ANCHORS) {
        const match = anchor.exec(masked);

        if (match !== null) {
            bodyStart = match.index + match[0].length;

            break;
        }
    }

    if (bodyStart === undefined) {
        return { kind: "no-anchor" };
    }

    let depth = 1;
    let hasReleaseKey = false;
    let index = bodyStart;

    while (index < masked.length) {
        const char = masked[index] as string;

        if (char === "{") {
            depth += 1;
            index += 1;

            continue;
        }

        if (char === "}") {
            depth -= 1;

            if (depth === 0) {
                return { bodyStart, hasReleaseKey, kind: "found" };
            }

            index += 1;

            continue;
        }

        if (char === "\"" || char === "'") {
            // Literal bodies are blanked, so the matching delimiter is the
            // next one of the same kind. Read the key name back out of the
            // original source, where it survived intact.
            const close = masked.indexOf(char, index + 1);

            if (close === -1) {
                return { kind: "unterminated" };
            }

            if (depth === 1 && source.slice(index + 1, close) === "release" && isKeyPosition(masked, close + 1)) {
                hasReleaseKey = true;
            }

            index = close + 1;

            continue;
        }

        IDENTIFIER.lastIndex = index;

        const identifier = IDENTIFIER.exec(masked);

        if (identifier !== null) {
            const end = index + identifier[0].length;

            // `...release` is a spread of a variable, not a property named `release`.
            if (depth === 1 && identifier[0] === "release" && masked[index - 1] !== "." && isKeyPosition(masked, end)) {
                hasReleaseKey = true;
            }

            index = end;

            continue;
        }

        index += 1;
    }

    return { kind: "unterminated" };
};
