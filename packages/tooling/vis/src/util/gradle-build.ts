/**
 * Reads the parts of a Gradle build that vis needs, from the text of
 * `settings.gradle(.kts)` and `build.gradle(.kts)`.
 *
 * Both files are Groovy or Kotlin code, so this is a reader, not a parser. It
 * recognises the declarations vis supports (`group`, `version`, `include`,
 * `project(":x")`) and reports the constructs it cannot follow, so the caller
 * can refuse them instead of guessing a value.
 *
 * Every function works on the masked text from {@link maskGradleComments}, whose
 * offsets match the original, so a value can be rewritten in place.
 */

/**
 * Blank out `//` and block comments with spaces, keeping newlines and every
 * offset. String literals are left alone, so a `//` inside a URL is not a comment.
 */
export const maskGradleComments = (text: string): string => {
    let out = "";
    let quote: string | undefined;
    let index = 0;

    while (index < text.length) {
        const char = text[index]!;
        const next = text[index + 1];

        if (quote !== undefined) {
            out += char;

            if (char === "\\" && next !== undefined) {
                out += next;
                index += 2;

                continue;
            }

            if (char === quote || char === "\n") {
                quote = undefined;
            }

            index += 1;

            continue;
        }

        if (char === "\"" || char === "'") {
            quote = char;
        }

        if (char === "/" && next === "/") {
            const eol = text.indexOf("\n", index);
            const stop = eol === -1 ? text.length : eol;

            out += " ".repeat(stop - index);
            index = stop;

            continue;
        }

        if (char === "/" && next === "*") {
            const end = text.indexOf("*/", index + 2);
            const stop = end === -1 ? text.length : end + 2;

            out += text.slice(index, stop).replaceAll(/[^\n]/g, " ");
            index = stop;

            continue;
        }

        out += char;
        index += 1;
    }

    return out;
};

export interface GradleAssignment {
    /** Enclosing block labels, outermost first. `[]` is the top level of the script. */
    blocks: string[];
    /** 1-based line of the declaration. */
    line: number;
    /** The value when it is one plain string literal, so it can be rewritten. */
    literal?: { value: string; valueEnd: number; valueStart: number };
    name: "group" | "version";
}

export interface GradleBuildScan {
    assignments: GradleAssignment[];
    /** Paths of every `project(":x")` reference, as written (e.g. `:lib:core`). */
    projectRefs: string[];
    /** True when the script uses a construct vis cannot follow to a version (archive names). */
    usesArchiveName: boolean;
}

const DECLARATION = /^(\s*)(group|version)(\s*=\s*|\s+)(.*?)\s*;?\s*$/d;
const LITERAL_VALUE = /^(["'])([^"'$\n]*)\1$/;
const ALL_OR_SUB_PROJECTS = /\b(allprojects|subprojects)\b/;
const LAST_WORD = /([A-Z_]\w*)\s*(?:\([^()]*\))?\s*$/i;

/** The block label for a brace opened after `text`, such as allprojects, plugins or configure. */
const blockLabel = (text: string): string => {
    const named = ALL_OR_SUB_PROJECTS.exec(text);

    if (named) {
        return named[1]!;
    }

    return LAST_WORD.exec(text.trim())?.[1] ?? "";
};

/**
 * Read a build script. Each statement (split on newline, `;`, `{`, `}`) is checked
 * for a `group` or `version` declaration together with the blocks it sits in, so a
 * one-line `allprojects { version = "1.0" }` is found as well.
 */
export const scanGradleBuild = (raw: string): GradleBuildScan => {
    const masked = maskGradleComments(raw);
    const assignments: GradleAssignment[] = [];
    const blocks: string[] = [];
    let segmentStart = 0;
    let pendingLabel = "";
    let quote: string | undefined;
    let escaped = false;

    const lineOf = (offset: number): number => masked.slice(0, offset).split("\n").length;

    const checkSegment = (start: number, end: number): void => {
        const text = masked.slice(start, end);
        const match = DECLARATION.exec(text);

        if (match?.indices === undefined) {
            return;
        }

        const name = match[2] as GradleAssignment["name"];
        const value = match[4] ?? "";
        const literal = LITERAL_VALUE.exec(value);
        const assignment: GradleAssignment = { blocks: [...blocks], line: lineOf(start + match.indices[0]![0]), name };

        if (literal) {
            const valueStart = start + match.indices[4]![0] + 1;

            assignment.literal = { value: literal[2]!, valueEnd: valueStart + literal[2]!.length, valueStart };
        }

        assignments.push(assignment);
    };

    for (let index = 0; index < masked.length; index++) {
        const char = masked[index]!;

        if (quote !== undefined) {
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote || char === "\n") {
                quote = undefined;
            }

            continue;
        }

        if (char === "\"" || char === "'") {
            quote = char;

            continue;
        }

        if (char === "\n" || char === ";" || char === "{" || char === "}") {
            checkSegment(segmentStart, index);

            const segment = masked.slice(segmentStart, index).trim();

            if (char === "{") {
                if (segment !== "") {
                    pendingLabel = segment;
                }

                blocks.push(blockLabel(pendingLabel));
                pendingLabel = "";
            } else if (char === "}") {
                blocks.pop();
            } else if (segment !== "") {
                pendingLabel = segment;
            }

            segmentStart = index + 1;
        }
    }

    checkSegment(segmentStart, masked.length);

    const projectRefs = [...masked.matchAll(/\bproject\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1]!);

    return {
        assignments,
        projectRefs,
        usesArchiveName: /\barchives(?:Base)?Name\b/.test(masked),
    };
};

/** A module's own declarations: top level of its build script. */
export const ownAssignments = (assignments: ReadonlyArray<GradleAssignment>, name: GradleAssignment["name"]): GradleAssignment[] =>
    assignments.filter((assignment) => assignment.name === name && assignment.blocks.length === 0);

/**
 * Declarations in the root script that reach a module that does not set its own
 * value: `allprojects` for every module, `subprojects` for non-root modules. A
 * top-level assignment in the root script sets the root project only.
 */
export const inheritedAssignments = (assignments: ReadonlyArray<GradleAssignment>, name: GradleAssignment["name"], root: boolean): GradleAssignment[] =>
    assignments.filter(
        (assignment) =>
            assignment.name === name
            && assignment.blocks.length === 1
            && (assignment.blocks[0] === "allprojects" || (!root && assignment.blocks[0] === "subprojects")),
    );

export interface GradleSettingsScan {
    /** `include` calls built from code (loops, variables), which vis cannot enumerate. */
    dynamicIncludes: boolean;
    /** Module paths relative to the build root, `/`-separated (`:lib:core` → `lib/core`). */
    includes: string[];
    /** A `rootProject.name` assignment, which renames the root artifact. */
    rootName?: string;
    /** Constructs that move a project to another directory or rename it. */
    unsupported: string[];
}

const INCLUDE = /\binclude\b\s*(\(?)/g;
const STRING_LITERAL = /(["'])([^"'\n]*)\1/g;

/** Collect the text of one `include` call: up to the closing paren, or the end of the statement. */
const includeStatement = (masked: string, from: number, openedParen: boolean): string => {
    let depth = openedParen ? 1 : 0;
    let quote: string | undefined;
    let index = from;

    for (; index < masked.length; index++) {
        const char = masked[index]!;

        if (quote !== undefined) {
            if (char === quote) {
                quote = undefined;
            }

            continue;
        }

        switch (char) {
            case "\n":
            case ";":
            case "{":
            case "}": {
                if (depth <= 0 && (char !== "\n" || !/,\s*$/.test(masked.slice(from, index)))) {
                    return masked.slice(from, index);
                }

                break;
            }
            case "\"":
            case "'": {
                quote = char;

                break;
            }
            case "(": {
                depth++;

                break;
            }
            case ")": {
                depth--;

                if (depth <= 0 && openedParen) {
                    return masked.slice(from, index);
                }

                break;
            }
            default: {
                break;
            }
        }
    }

    return masked.slice(from, index);
};

/** Read `settings.gradle(.kts)`. Module paths are returned; `project(…).projectDir` and `project(…).name` are reported. */
export const scanGradleSettings = (raw: string): GradleSettingsScan => {
    const masked = maskGradleComments(raw);
    const includes = new Set<string>();
    const unsupported: string[] = [];
    let dynamicIncludes = false;

    for (const match of masked.matchAll(INCLUDE)) {
        const statement = includeStatement(masked, match.index + match[0].length, match[1] === "(");
        const literals = [...statement.matchAll(STRING_LITERAL)].map((literal) => literal[2]!);
        const residue = statement.replaceAll(STRING_LITERAL, "").replaceAll(/[\s(),]/g, "");

        if (residue !== "") {
            dynamicIncludes = true;
        }

        for (const value of literals) {
            const path = value.replace(/^:+/, "").split(":").filter((part) => part !== "").join("/");

            if (path !== "") {
                includes.add(path);
            }
        }
    }

    if (/\.projectDir\s*=/.test(masked)) {
        unsupported.push("projectDir");
    }

    if (/\bproject\(\s*["'][^"']*["']\s*\)\s*\.\s*name\s*=/.test(masked)) {
        unsupported.push("project name");
    }

    const rootName = /\brootProject\.name\s*=\s*["']([^"']+)["']/.exec(masked)?.[1];

    return {
        dynamicIncludes,
        includes: [...includes],
        ...(rootName === undefined ? {} : { rootName }),
        unsupported,
    };
};

/**
 * Rewrite one literal value in the original text. `valueStart` and `valueEnd`
 * come from {@link scanGradleBuild} on that same text.
 */
export const replaceGradleLiteral = (raw: string, literal: { valueEnd: number; valueStart: number }, value: string): string =>
    `${raw.slice(0, literal.valueStart)}${value}${raw.slice(literal.valueEnd)}`;
