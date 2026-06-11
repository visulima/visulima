import NotFoundError from "../../error/not-found-error";
import PermissionError from "../../error/permission-error";

/**
 * Maps a Node.js filesystem error thrown while reading a file to one of the
 * package's typed error classes.
 *
 * - `ENOENT` -> {@link NotFoundError}
 * - `EACCES` / `EPERM` -> {@link PermissionError}
 *
 * Any other error (including `EISDIR`) is returned unchanged so the caller can
 * rethrow it as-is.
 * @param error The error thrown by a `node:fs` read call.
 * @param path The path that was being read, used to build a helpful message.
 * @returns The error to throw.
 */
const mapReadError = (error: unknown, path: URL | string): unknown => {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;

    if (code === "ENOENT") {
        return new NotFoundError(`no such file or directory, open '${path}'`);
    }

    if (code === "EACCES" || code === "EPERM") {
        return new PermissionError(`unable to read the non-readable file: ${path}`);
    }

    return error;
};

export default mapReadError;
