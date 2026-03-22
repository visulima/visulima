/* eslint-disable */
/* auto-generated binding loader for @visulima/task-runner native addon */

const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const { platform, arch } = process;

let nativeBinding = null;
let localFileExisted = false;
let loadError = null;

function isMusl() {
    // For Node 12+, check report.header for musl
    if (
        typeof process.report !== "undefined" &&
        typeof process.report.getReport === "function"
    ) {
        const { glibcVersionRuntime } = process.report.getReport().header;
        if (glibcVersionRuntime) {
            return false;
        }
        return true;
    }

    try {
        const lddOutput = readFileSync("/usr/bin/ldd", "utf8");
        return lddOutput.includes("musl");
    } catch {
        try {
            return readFileSync("/proc/self/map_files/../maps", "utf8").includes(
                "musl"
            );
        } catch {
            return false;
        }
    }
}

switch (platform) {
    case "darwin":
        switch (arch) {
            case "x64":
                localFileExisted = existsSync(
                    join(__dirname, "task-runner-native.darwin-x64.node")
                );
                try {
                    if (localFileExisted) {
                        nativeBinding = require("./task-runner-native.darwin-x64.node");
                    } else {
                        nativeBinding = require("@visulima/task-runner-binding-darwin-x64");
                    }
                } catch (e) {
                    loadError = e;
                }
                break;
            case "arm64":
                localFileExisted = existsSync(
                    join(__dirname, "task-runner-native.darwin-arm64.node")
                );
                try {
                    if (localFileExisted) {
                        nativeBinding = require("./task-runner-native.darwin-arm64.node");
                    } else {
                        nativeBinding = require("@visulima/task-runner-binding-darwin-arm64");
                    }
                } catch (e) {
                    loadError = e;
                }
                break;
            default:
                throw new Error(`Unsupported architecture on macOS: ${arch}`);
        }
        break;
    case "linux":
        switch (arch) {
            case "x64":
                if (isMusl()) {
                    localFileExisted = existsSync(
                        join(
                            __dirname,
                            "..",
                            "task-runner-native.linux-x64-musl.node"
                        )
                    );
                    try {
                        if (localFileExisted) {
                            nativeBinding = require("./task-runner-native.linux-x64-musl.node");
                        } else {
                            nativeBinding = require("@visulima/task-runner-binding-linux-x64-musl");
                        }
                    } catch (e) {
                        loadError = e;
                    }
                } else {
                    localFileExisted = existsSync(
                        join(
                            __dirname,
                            "..",
                            "task-runner-native.linux-x64-gnu.node"
                        )
                    );
                    try {
                        if (localFileExisted) {
                            nativeBinding = require("./task-runner-native.linux-x64-gnu.node");
                        } else {
                            nativeBinding = require("@visulima/task-runner-binding-linux-x64-gnu");
                        }
                    } catch (e) {
                        loadError = e;
                    }
                }
                break;
            case "arm64":
                if (isMusl()) {
                    localFileExisted = existsSync(
                        join(
                            __dirname,
                            "..",
                            "task-runner-native.linux-arm64-musl.node"
                        )
                    );
                    try {
                        if (localFileExisted) {
                            nativeBinding = require("./task-runner-native.linux-arm64-musl.node");
                        } else {
                            nativeBinding = require("@visulima/task-runner-binding-linux-arm64-musl");
                        }
                    } catch (e) {
                        loadError = e;
                    }
                } else {
                    localFileExisted = existsSync(
                        join(
                            __dirname,
                            "..",
                            "task-runner-native.linux-arm64-gnu.node"
                        )
                    );
                    try {
                        if (localFileExisted) {
                            nativeBinding = require("./task-runner-native.linux-arm64-gnu.node");
                        } else {
                            nativeBinding = require("@visulima/task-runner-binding-linux-arm64-gnu");
                        }
                    } catch (e) {
                        loadError = e;
                    }
                }
                break;
            default:
                throw new Error(`Unsupported architecture on Linux: ${arch}`);
        }
        break;
    case "win32":
        switch (arch) {
            case "x64":
                localFileExisted = existsSync(
                    join(
                        __dirname,
                        "..",
                        "task-runner-native.win32-x64-msvc.node"
                    )
                );
                try {
                    if (localFileExisted) {
                        nativeBinding = require("./task-runner-native.win32-x64-msvc.node");
                    } else {
                        nativeBinding = require("@visulima/task-runner-binding-win32-x64-msvc");
                    }
                } catch (e) {
                    loadError = e;
                }
                break;
            case "arm64":
                localFileExisted = existsSync(
                    join(
                        __dirname,
                        "..",
                        "task-runner-native.win32-arm64-msvc.node"
                    )
                );
                try {
                    if (localFileExisted) {
                        nativeBinding = require("./task-runner-native.win32-arm64-msvc.node");
                    } else {
                        nativeBinding = require("@visulima/task-runner-binding-win32-arm64-msvc");
                    }
                } catch (e) {
                    loadError = e;
                }
                break;
            default:
                throw new Error(`Unsupported architecture on Windows: ${arch}`);
        }
        break;
    default:
        throw new Error(
            `Unsupported OS: ${platform}, architecture: ${arch}`
        );
}

if (!nativeBinding) {
    if (loadError) {
        throw loadError;
    }
    throw new Error("Failed to load native binding");
}

module.exports = nativeBinding;
