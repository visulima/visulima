import trimSlashes from "./trim-slashes";

/**
 * POSIX-style `dirname` for remote (FTP/SFTP) paths. Preserves a leading
 * slash for absolute inputs and returns `""` when there is no parent
 * directory.
 */
const posixDirname = (path: string): string => {
    const trimmed = trimSlashes(path);
    const index = trimmed.lastIndexOf("/");

    if (index <= 0) {
        return path.startsWith("/") && index === 0 ? "/" : "";
    }

    return path.startsWith("/") ? `/${trimmed.slice(0, index)}` : trimmed.slice(0, index);
};

export default posixDirname;
