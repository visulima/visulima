import { dirname, resolve } from "@visulima/path";

const resolveSymlinkTarget = (target: URL | string, linkName: URL | string): URL | string => {
    if (typeof target !== "string") {
        return target;
    }

    if (target.startsWith("./")) {
        return resolve(target);
    }

    // URL is always absolute path
    if (typeof linkName === "string") {
        return resolve(dirname(linkName), target);
    }

    return new URL(target, linkName);
};

export default resolveSymlinkTarget;
