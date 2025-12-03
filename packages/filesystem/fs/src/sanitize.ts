import { platform } from "node:process";

const FALLBACK_NAME = "unnamed";

const MAX_LENGTH = 128;

const REPLACEMENT_CHARACTERS: Record<string, string> = {
    "\"": "ˮ", // 0x02EE - MODIFIER LETTER DOUBLE APOSTROPHE
    "*": "⁎", // 0x204E - LOW ASTERISK
    "/": "⁄", // 0x2044 - FRACTION SLASH
    ":": "꞉", // 0xA789 - MODIFIER LETTER COLON
    "<": "‹", // 0x2039 - SINGLE LEFT-POINTING ANGLE QUOTATION MARK
    ">": "›", // 0x203A - SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
    "?": "ʔ", // 0x0294 - LATIN LETTER GLOTTAL STOP
    "\\": "∖", // 0x2216 - SET MINUS
    "|": "ǀ", // 0x01C0 - LATIN LETTER DENTAL CLICK
};

// Pre-compiled regexes for better performance
// Control characters: C0 controls (0x00-0x1F) and C1 controls (0x80-0x9F)
// eslint-disable-next-line no-control-regex, sonarjs/no-control-regex
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u0080-\u009F]/g;
const RELATIVE_PATHS_REGEX = /^(?:\.+[/\\]+)+|^\.+$/g;
const WINDOWS_SPECIAL_NAMES_REGEX = /^(?:con|prn|aux|nul|com\d|lpt\d)$/i;

// Windows forbidden characters: < > : " / \ | ? *
const WINDOWS_FORBIDDEN_CHARS_REGEX = /[<>:"/\\|?*]/g;

// Unix forbidden characters: / and \0 (null)
const UNIX_FORBIDDEN_CHARS_REGEX = /\//g;

// Characters to trim (spaces, periods, tabs) - using Set for O(1) lookup
const TRIM_CHARS = new Set<string>(["\t", " ", "."]);

/**
 * Checks if a string has a valid file extension.
 * @param name The filename to check
 * @param lastDotIndex The index of the last dot (from lastIndexOf("."))
 * @returns True if the name has a valid extension
 */
const hasExtension = (name: string, lastDotIndex: number): boolean => lastDotIndex > 0 && lastDotIndex < name.length - 1;

/**
 * Truncates a filename while preserving extension if possible.
 */
const truncateWithExtension = (name: string, maxLength: number): string => {
    const lastDotIndex = name.lastIndexOf(".");

    if (!hasExtension(name, lastDotIndex)) {
        return name.slice(0, maxLength);
    }

    const baseName = name.slice(0, lastDotIndex);
    const extension = name.slice(lastDotIndex);
    const maxBaseLength = maxLength - extension.length;

    return maxBaseLength > 0 ? `${baseName.slice(0, maxBaseLength)}${extension}` : name.slice(0, maxLength);
};

/**
 * Removes leading and trailing spaces and periods from a string.
 * Used for FAT32 filename sanitization.
 */
const trimSpacesAndPeriods = (input: string): string => {
    let start = 0;
    let end = input.length;

    // Find first non-space, non-period character (using Set for O(1) lookup)
    while (start < end) {
        const char = input[start];

        if (char === undefined || !TRIM_CHARS.has(char)) {
            break;
        }

        start += 1;
    }

    // Find last non-space, non-period character
    while (end > start) {
        const char = input[end - 1];

        if (char === undefined || !TRIM_CHARS.has(char)) {
            break;
        }

        end -= 1;
    }

    return input.slice(start, end);
};

/**
 * Removes trailing periods and spaces from Windows filenames.
 * Windows does not allow trailing periods or spaces in filenames.
 */
const cleanWindowsName = (name: string): string => {
    const lastDotIndex = name.lastIndexOf(".");

    if (hasExtension(name, lastDotIndex)) {
        const baseName = name.slice(0, lastDotIndex);
        const extension = name.slice(lastDotIndex);
        // Remove trailing periods and spaces from base name only (using Set for O(1) lookup)
        let cleanedBaseName = baseName;

        while (cleanedBaseName.length > 0) {
            const char = cleanedBaseName[cleanedBaseName.length - 1];

            if (char === undefined || !TRIM_CHARS.has(char)) {
                break;
            }

            cleanedBaseName = cleanedBaseName.slice(0, -1);
        }

        if (cleanedBaseName.length === 0) {
            return extension.slice(1); // Return extension without dot if base name becomes empty
        }

        return `${cleanedBaseName}${extension}`;
    }

    // No extension - remove trailing periods and spaces
    let cleaned = name;

    while (cleaned.length > 0) {
        const char = cleaned[cleaned.length - 1];

        if (char === undefined || !TRIM_CHARS.has(char)) {
            break;
        }

        cleaned = cleaned.slice(0, -1);
    }

    return cleaned;
};

/**
 * Checks if a name is a Windows reserved name.
 * Windows treats reserved names with trailing periods/spaces as reserved.
 * Reserved names with extensions are allowed (e.g., "CON.txt" is valid, but "CON " is not).
 */
const isWindowsReservedName = (name: string): boolean => {
    const lastDotIndex = name.lastIndexOf(".");

    if (hasExtension(name, lastDotIndex)) {
        // Windows allows reserved names WITH extensions (e.g., "CON.txt" is valid)
        // So we never reject names with extensions, even if the base name is reserved
        return false;
    }

    // No extension - check the full name
    if (WINDOWS_SPECIAL_NAMES_REGEX.test(name)) {
        return true;
    }

    // Check if name with trailing period/space is reserved (e.g., "CON ", "PRN.")
    // Use a while loop instead of regex to avoid backtracking issues (using Set for O(1) lookup)
    let trimmed = name;

    while (trimmed.length > 0) {
        const char = trimmed[trimmed.length - 1];

        if (char === undefined || !TRIM_CHARS.has(char)) {
            break;
        }

        trimmed = trimmed.slice(0, -1);
    }

    if (trimmed.length > 0 && WINDOWS_SPECIAL_NAMES_REGEX.test(trimmed)) {
        return true;
    }

    return false;
};

/**
 * Removes leading and trailing spaces and periods from FAT32 filenames.
 * FAT32 does not allow leading/trailing spaces or periods in the name part.
 */
const cleanFat32Name = (name: string): string | undefined => {
    const lastDotIndex = name.lastIndexOf(".");

    if (hasExtension(name, lastDotIndex)) {
        const baseName = name.slice(0, lastDotIndex);
        const extension = name.slice(lastDotIndex);
        const cleanedBaseName = trimSpacesAndPeriods(baseName);

        if (cleanedBaseName.length === 0) {
            return undefined;
        }

        return `${cleanedBaseName}${extension}`;
    }

    // No extension - clean the entire name
    // This handles cases like " . filename . " or ".txt" or "..."
    // First, check if the trimmed input looks like extension-only before cleaning
    const trimmed = name.trim();

    // If it starts with a dot and is short, it might be extension-only
    if (trimmed.length > 0 && trimmed[0] === "." && trimmed.length <= 5) {
        const secondDotIndex = trimmed.indexOf(".", 1);

        // If no second dot, it's likely extension-only (like ".txt")
        if (secondDotIndex === -1) {
            return undefined;
        }
    }

    const cleaned = trimSpacesAndPeriods(name);

    if (cleaned.length === 0) {
        return undefined;
    }

    return cleaned;
};

/**
 * Determines the target filesystem type from options or platform.
 */
const getFileSystemType = (options?: Partial<SanitizeOptions>): "win32" | "unix" | "fat32" => {
    const filesystem = options?.filesystem ?? "auto";

    if (filesystem === "auto") {
        return platform === "win32" ? "win32" : "unix";
    }

    if (filesystem === "darwin") {
        return "unix";
    }

    return filesystem;
};

/**
 * Supported filesystem types
 */
export type FileSystemType = "win32" | "unix" | "darwin" | "fat32" | "auto";

/**
 * Options for the sanitize function
 */
export interface SanitizeOptions {
    /**
     * Target filesystem type for sanitization rules
     * - "win32": Windows filesystem rules (reserved names, Windows forbidden chars, no trailing periods/spaces)
     * - "unix": Unix/Linux filesystem rules (only / and null forbidden)
     * - "darwin": macOS filesystem rules (same as unix)
     * - "fat32": FAT32 filesystem rules (Windows rules + no leading/trailing spaces/periods in name part)
     * - "auto": Automatically detect from process.platform
     * @default "auto"
     */
    filesystem?: FileSystemType;

    /**
     * Maximum length of the sanitized name
     * @default 128
     */
    maxLength?: number;
}

/**
 * Sanitizes a filename by removing or replacing forbidden characters.
 * @param name The filename to sanitize.
 * @param options Optional configuration.
 * @returns The sanitized filename, or "unnamed" if the result would be empty.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const sanitize = (name: string, options?: Partial<SanitizeOptions>): string => {
    if (typeof name !== "string" || name.length === 0) {
        return FALLBACK_NAME;
    }

    const fileSystemType = getFileSystemType(options);
    let sanitized = name;

    // Remove control characters
    // eslint-disable-next-line unicorn/prefer-string-replace-all
    sanitized = sanitized.replace(CONTROL_CHARS_REGEX, "");

    if (sanitized.length === 0) {
        return FALLBACK_NAME;
    }

    // Remove relative paths
    // eslint-disable-next-line unicorn/prefer-string-replace-all
    sanitized = sanitized.replace(RELATIVE_PATHS_REGEX, "");

    if (sanitized.length === 0) {
        return FALLBACK_NAME;
    }

    // Check Windows reserved names (for win32 and fat32 filesystems)
    // Note: We check reserved names without extensions here, and with extensions after trimming below
    if (fileSystemType === "win32" || fileSystemType === "fat32") {
        const lastDotIndex = sanitized.lastIndexOf(".");

        // Only check reserved names if there's no extension (Windows allows reserved names WITH extensions)
        if (!hasExtension(sanitized, lastDotIndex) && WINDOWS_SPECIAL_NAMES_REGEX.test(sanitized)) {
            return FALLBACK_NAME;
        }
    }

    // Replace forbidden characters based on filesystem type
    sanitized
        = fileSystemType === "win32" || fileSystemType === "fat32"
            ? sanitized.replaceAll(WINDOWS_FORBIDDEN_CHARS_REGEX, (char) => REPLACEMENT_CHARACTERS[char] ?? "")
            : sanitized.replaceAll(UNIX_FORBIDDEN_CHARS_REGEX, REPLACEMENT_CHARACTERS["/"] ?? "");

    // Trim whitespace
    sanitized = sanitized.trim();

    // Windows and FAT32: Remove trailing periods and spaces (Windows doesn't allow them)
    if (fileSystemType === "win32" || fileSystemType === "fat32") {
        // Check Windows reserved names after trimming (handles "CON ", "PRN.", etc.)
        if (isWindowsReservedName(sanitized)) {
            return FALLBACK_NAME;
        }

        // For FAT32, we'll handle both leading and trailing in cleanFat32Name
        // For Windows only, just remove trailing periods and spaces
        if (fileSystemType === "win32") {
            sanitized = cleanWindowsName(sanitized);

            if (sanitized.length === 0) {
                return FALLBACK_NAME;
            }
        }
    }

    // FAT32 specific: Remove leading/trailing periods and spaces from name part (before extension)
    if (fileSystemType === "fat32") {
        const cleaned = cleanFat32Name(sanitized);

        if (cleaned === undefined) {
            return FALLBACK_NAME;
        }

        sanitized = cleaned;
    }

    if (sanitized.length === 0) {
        return FALLBACK_NAME;
    }

    // Apply max length constraint
    const maxLength = options?.maxLength ?? MAX_LENGTH;

    if (sanitized.length > maxLength) {
        sanitized = truncateWithExtension(sanitized, maxLength);

        // Ensure we didn't create an empty string
        if (sanitized.length === 0) {
            return FALLBACK_NAME;
        }
    }

    return sanitized;
};
