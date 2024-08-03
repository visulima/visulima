import { readFileSync, statSync } from "node:fs";

let isDockerCached: boolean | undefined;

const hasDockerEnvironment = () => {
    try {
        statSync("/.dockerenv");
        return true;
    } catch {
        return false;
    }
};

const hasDockerCGroup = () => {
    try {
        return readFileSync("/proc/self/cgroup", "utf8").includes("docker");
    } catch {
        return false;
    }
};

const isDocker = (): boolean => {
    if (isDockerCached === undefined) {
        isDockerCached = hasDockerEnvironment() || hasDockerCGroup();
    }

    return isDockerCached;
};

export default isDocker;
