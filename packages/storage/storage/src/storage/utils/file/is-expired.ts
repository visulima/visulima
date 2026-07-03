import type File from "./file";

/**
 * Checks if a file has expired based on its expiredAt timestamp.
 * @param file File object to check expiration for
 * @returns True if the file has expired, false otherwise
 */
const isExpired = (file: File): boolean => {
    if (!file.expiredAt) {
        return false;
    }

    return Date.now() > +new Date(file.expiredAt);
};

export default isExpired;
