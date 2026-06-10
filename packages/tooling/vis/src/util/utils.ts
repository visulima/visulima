const toStringArray = (value: unknown): string[] => {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? (value as string[]) : [value as string];
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

export { errorMessage, normalizeWorkspacePath, parsePackageArgument, toStringArray };
