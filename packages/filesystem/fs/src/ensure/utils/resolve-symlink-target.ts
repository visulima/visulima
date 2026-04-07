import { dirname, resolve } from "@visulima/path";

// eslint-disable-next-line sonarjs/function-return-type -- intentional: returns URL when input is URL, string when input is string
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
