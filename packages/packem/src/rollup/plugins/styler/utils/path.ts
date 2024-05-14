import path from "node:path";

export const isAbsolutePath = (path: string): boolean => /^(?:\/|(?:[A-Z]:)?[/\\|])/i.test(path);

export const isRelativePath = (path: string): boolean => /^\.?\.[/\\]/.test(path);

export function normalizePath(...paths: string[]): string {
    const f = path.join(...paths).replaceAll("\\", "/");

    if (/^\.[/\\]/.test(paths[0])) {
        return `./${f}`;
    }

    return f;
}

export const resolvePath = (...paths: string[]): string => normalizePath(path.resolve(...paths));

export const relativePath = (from: string, to: string): string => normalizePath(path.relative(from, to));

export const humanlizePath = (file: string): string => relativePath(process.cwd(), file);
