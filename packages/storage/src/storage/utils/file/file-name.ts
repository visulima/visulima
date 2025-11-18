/**
 * File name validation utilities.
 */
class FileName {
    /**
     * Validates a filename according to filesystem rules.
     * @param filename The filename to validate.
     * @returns True if the filename is valid, false otherwise.
     */
    public static isValid(filename: string): boolean {
        if (!filename || filename.length < 3 || filename.length > 255) {
            return false;
        }

        const upperCase = filename.toUpperCase();
        const filesystemInvalidChars = ["\"", "*", ":", "<", ">", "?", "\\", "|", "../", "\0"];

        // Check for absolute paths (Windows or Unix)
        if (filename.startsWith("/") || /^[a-zA-Z]:/.test(filename)) {
            return false;
        }

        // Check for invalid characters
        return !filesystemInvalidChars.some((char) => upperCase.includes(char));
    }
}

export default FileName;

