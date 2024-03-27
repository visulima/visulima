import { dirname, resolve } from "node:path";

const resolveSymlinkTarget = (target: URL | string, linkName: URL | string): URL | string => {
    if (typeof target !== "string") {
        return target;
    }

    // URL is always absolute path
    if (typeof linkName === "string") {
        return resolve(dirname(linkName), target);
    }

    // eslint-disable-next-line compat/compat
    return new URL(target, linkName);
};

export default resolveSymlinkTarget;
