/**
 * Shared utility for option parsing across command handlers.
 */

/**
 * Converts a CLI option value (which may be undefined, a single string,
 * or an array of strings) into a normalized string array.
 */
const toStringArray = (value: unknown): string[] => {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? (value as string[]) : [value as string];
};

/**
 * Safely extracts an error message from an unknown caught value.
 * Handles Error instances, strings, and other types.
 */
const errorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === "string") {
        return error;
    }

    return String(error);
};

// ── Package argument parsing ────────────────────────────────────────

const VERSION_SPEC_REGEX = /^(.+?)(?:@(.+))?$/;

/**
 * Extracts the package name and optional version specifier from a CLI argument
 * like "react", "react@19", "@scope/pkg@^2".
 */
const parsePackageArgument = (arg: string): { name: string; versionSpec: string | undefined } => {
    // Handle scoped packages: @scope/name@version
    if (arg.startsWith("@")) {
        const slashIndex = arg.indexOf("/");

        if (slashIndex === -1) {
            return { name: arg, versionSpec: undefined };
        }

        const afterSlash = arg.slice(slashIndex + 1);
        const atIndex = afterSlash.indexOf("@");

        if (atIndex === -1) {
            return { name: arg, versionSpec: undefined };
        }

        return {
            name: arg.slice(0, slashIndex + 1 + atIndex),
            versionSpec: afterSlash.slice(atIndex + 1),
        };
    }

    const match = VERSION_SPEC_REGEX.exec(arg);

    if (!match) {
        return { name: arg, versionSpec: undefined };
    }

    return { name: match[1], versionSpec: match[2] };
};

export { errorMessage, parsePackageArgument, toStringArray };
