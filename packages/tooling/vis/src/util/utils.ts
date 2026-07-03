const toStringArray = (value: unknown): string[] => {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? (value as string[]) : [value as string];
};

/**
 * Merge the cerebro `argument` positionals with the `rawUnknown` tail that
 * cerebro split off after the command (unknown flags + extra packages), so the
 * Node PM handlers forward exactly what the native binary does. A single leading
 * `--` in the unknown tail is the explicit "pass the rest through" separator, in
 * which case only the parsed `argument` list is used.
 */
const mergeForwardedPackages = (argument: ReadonlyArray<string> | undefined, rawUnknown: ReadonlyArray<string> | undefined): string[] => {
    const unknown = rawUnknown ?? [];

    return unknown[0] === "--" ? [...(argument ?? [])] : [...(argument ?? []), ...unknown];
};

const errorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === "string") {
        return error;
    }

    return String(error);
};

/** Strip a leading `./` and any trailing slash. Workspace paths are POSIX (`@visulima/path`'s `sep` is `/` everywhere). */
const normalizeWorkspacePath = (value: string): string => value.replace(/^\.\//, "").replace(/\/+$/, "");

// Control chars (incl. DEL), space, and git's forbidden refname characters: ~ ^ : ? * [ \
// eslint-disable-next-line no-control-regex
const FORBIDDEN_REF_CHARS_REGEX = /[\u0000-\u001F\u007F ~^:?*[\\]/g;

/**
 * Sanitize a string into a single, valid git refname component (no slashes).
 *
 * git forbids a range of characters in refnames; an unsanitized package path
 * fed into `git subtree split` can produce an invalid ref and abort the split.
 * This replaces control characters, spaces, and git's forbidden set
 * (`~ ^ : ? * [ \`), neutralizes the `@{` reflog selector and `..` range
 * operator, drops a trailing `.lock`, and trims leading/trailing dots, dashes,
 * or slashes. Falls back to `"split"` if the input sanitizes to empty.
 * @see https://git-scm.com/docs/git-check-ref-format
 */
const sanitizeGitRefComponent = (value: string): string => {
    const cleaned = value
        // `@{` is a reflog selector; `..` is a range operator — neither is a valid ref substring.
        .replaceAll("@{", "-")
        .replaceAll("..", "-")
        .replaceAll(FORBIDDEN_REF_CHARS_REGEX, "-")
        // A refname component may not end with `.lock`.
        .replace(/\.lock$/i, "")
        // No leading/trailing dot, dash, or slash.
        .replace(/^[./-]+/, "")
        .replace(/[./-]+$/, "");

    return cleaned.length > 0 ? cleaned : "split";
};

const VERSION_SPEC_REGEX = /^(.+?)(?:@(.+))?$/;

/**
 * Extracts the package name and optional version specifier from a CLI argument
 * like "react", "react@19", "@scope/pkg@^2".
 */
const parsePackageArgument = (argument: string): { name: string; versionSpec: string | undefined } => {
    // Handle scoped packages: @scope/name@version
    if (argument.startsWith("@")) {
        const slashIndex = argument.indexOf("/");

        if (slashIndex === -1) {
            return { name: argument, versionSpec: undefined };
        }

        const afterSlash = argument.slice(slashIndex + 1);
        const atIndex = afterSlash.indexOf("@");

        if (atIndex === -1) {
            return { name: argument, versionSpec: undefined };
        }

        return {
            name: argument.slice(0, slashIndex + 1 + atIndex),
            versionSpec: afterSlash.slice(atIndex + 1),
        };
    }

    const match = VERSION_SPEC_REGEX.exec(argument);

    if (!match) {
        return { name: argument, versionSpec: undefined };
    }

    return { name: match[1] ?? argument, versionSpec: match[2] };
};

export { errorMessage, mergeForwardedPackages, normalizeWorkspacePath, parsePackageArgument, sanitizeGitRefComponent, toStringArray };
