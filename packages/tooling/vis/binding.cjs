/* eslint-disable */
/* auto-generated binding loader for @visulima/vis native addon */

const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const { platform, arch } = process;

let nativeBinding = null;
let loadError = null;

function isMusl() {
    if (typeof process.report !== "undefined" && typeof process.report.getReport === "function") {
        const { glibcVersionRuntime } = process.report.getReport().header;
        return !glibcVersionRuntime;
    }
    try {
        return readFileSync("/usr/bin/ldd", "utf8").includes("musl");
    } catch {
        try {
            return readFileSync("/proc/self/map_files/../maps", "utf8").includes("musl");
        } catch {
            return false;
        }
    }
}

function tryLoad(localName, packageName) {
    // Try local .node file first (dev builds)
    const localPath = join(__dirname, localName);
    if (existsSync(localPath)) {
        try { return require(localPath); } catch (e) { loadError = e; }
    }
    // Try napi default name (index.<platform>.node)
    const indexName = localName.replace("vis-native.", "index.");
    const indexPath = join(__dirname, indexName);
    if (existsSync(indexPath)) {
        try { return require("./" + indexName); } catch (e) { loadError = e; }
    }
    // Try platform package (only if local files weren't found)
    if (!existsSync(localPath) && !existsSync(indexPath)) {
        try { return require(packageName); } catch (e) { loadError = e; }
    }
    return null;
}

switch (platform) {
    case "darwin":
        switch (arch) {
            case "x64":
                nativeBinding = tryLoad("vis-native.darwin-x64.node", "@visulima/vis-binding-darwin-x64");
                break;
            case "arm64":
                nativeBinding = tryLoad("vis-native.darwin-arm64.node", "@visulima/vis-binding-darwin-arm64");
                break;
            default:
                throw new Error(`Unsupported architecture on macOS: ${arch}`);
        }
        break;
    case "linux":
        switch (arch) {
            case "x64":
                if (isMusl()) {
                    nativeBinding = tryLoad("vis-native.linux-x64-musl.node", "@visulima/vis-binding-linux-x64-musl");
                } else {
                    nativeBinding = tryLoad("vis-native.linux-x64-gnu.node", "@visulima/vis-binding-linux-x64-gnu");
                }
                break;
            case "arm64":
                if (isMusl()) {
                    nativeBinding = tryLoad("vis-native.linux-arm64-musl.node", "@visulima/vis-binding-linux-arm64-musl");
                } else {
                    nativeBinding = tryLoad("vis-native.linux-arm64-gnu.node", "@visulima/vis-binding-linux-arm64-gnu");
                }
                break;
            default:
                throw new Error(`Unsupported architecture on Linux: ${arch}`);
        }
        break;
    case "win32":
        switch (arch) {
            case "x64":
                nativeBinding = tryLoad("vis-native.win32-x64-msvc.node", "@visulima/vis-binding-win32-x64-msvc");
                break;
            case "arm64":
                nativeBinding = tryLoad("vis-native.win32-arm64-msvc.node", "@visulima/vis-binding-win32-arm64-msvc");
                break;
            default:
                throw new Error(`Unsupported architecture on Windows: ${arch}`);
        }
        break;
    default:
        throw new Error(`Unsupported OS: ${platform}, architecture: ${arch}`);
}

if (!nativeBinding) {
    if (loadError) {
        throw loadError;
    }
    throw new Error("Failed to load native binding");
}

module.exports = nativeBinding;
