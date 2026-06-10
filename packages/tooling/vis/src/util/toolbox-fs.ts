import type { CerebroFs } from "@visulima/cerebro";

export const pathExists = async (fs: CerebroFs, path: string): Promise<boolean> => {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
};

export const readJsonFile = async <T = unknown>(fs: CerebroFs, path: string): Promise<T> =>
    JSON.parse(await fs.readFile(path, "utf8")) as T;

export const writeJsonFile = async (fs: CerebroFs, path: string, value: unknown, indent = 4): Promise<void> =>
    fs.writeFile(path, `${JSON.stringify(value, undefined, indent)}\n`, "utf8");

export const removeFile = async (fs: CerebroFs, path: string): Promise<void> =>
    fs.rm(path, { force: true });
