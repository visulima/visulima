import {
    existsSync, mkdirSync, readFileSync, writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const homeDirectory = homedir();
const configDir = process.env["XDG_CONFIG_HOME"] || join(homeDirectory, ".config", "simple-update-notifier");

const getConfigFile = (packageName: string) => join(configDir, `${packageName.replace("@", "").replace("/", "__")}.json`);

export const createConfigDirectory = () => {

    if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
    }
};

export const getLastUpdate = (packageName: string) => {
    const configFile = getConfigFile(packageName);

    try {
        if (!existsSync(configFile)) {
            return undefined;
        }

        const file = JSON.parse(readFileSync(configFile, "utf8"));

        return file.lastUpdateCheck as number;
    } catch {
        return undefined;
    }
};

export const saveLastUpdate = (packageName: string) => {
    const configFile = getConfigFile(packageName);

    writeFileSync(configFile, JSON.stringify({ lastUpdateCheck: Date.now() }));
};
