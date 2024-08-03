import isDocker from "./is-docker";
import { readFileSync, accessSync, constants as fsConstants } from "node:fs";
import { release } from "node:os";

let isWSLCached: boolean;

export function isWsl() {
    if (isWSLCached === undefined) {
        isWSLCached = _isWsl();
    }
    return isWSLCached;
}

function _isWsl() {
    if (process.platform !== "linux") {
        return false;
    }

    if (release().toLowerCase().includes("microsoft")) {
        return !isDocker();
    }

    try {
        return readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft") ? !isDocker() : false;
    } catch {
        return false;
    }
}

// Get the mount point for fixed drives in WSL.
const defaultMountPoint = "/mnt/";
let _wslMountpoint: string;

// Default value for "root" param
// according to https://docs.microsoft.com/en-us/windows/wsl/wsl-config
const getWslDrivesMountPoint = (): string => {
    if (_wslMountpoint) {
        // Return memoized mount point value
        return _wslMountpoint;
    }

    const configFilePath = "/etc/wsl.conf";

    let isConfigFileExists = false;
    try {
        accessSync(configFilePath, fsConstants.F_OK);
        isConfigFileExists = true;
    } catch {}

    if (!isConfigFileExists) {
        return defaultMountPoint;
    }

    const configContent = readFileSync(configFilePath, { encoding: "utf8" });
    const configMountPoint = /(?<!#.*)root\s*=\s*(?<mountPoint>.*)/g.exec(configContent);

    if (!configMountPoint || !configMountPoint.groups) {
        return defaultMountPoint;
    }

    _wslMountpoint = configMountPoint.groups.mountPoint.trim();
    _wslMountpoint = _wslMountpoint.endsWith("/") ? _wslMountpoint : `${_wslMountpoint}/`;

    return _wslMountpoint;
};

export default getWslDrivesMountPoint;
