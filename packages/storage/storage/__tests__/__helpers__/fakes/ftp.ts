import type { Readable, Writable } from "node:stream";

// Copied from __tests__/storage/ftp/ftp-fake.test.ts so other suites can share it. Install it with
// vi.mock(import("basic-ftp"), async () => import("../__helpers__/fakes/ftp")).

/** In-memory FTP server state; `fail` makes one client method (`*`: every method) throw. */
export const server: { dirs: Set<string>; fail: Record<string, Error>; files: Map<string, { body: Buffer; modifiedAt: Date }> } = {
    dirs: new Set<string>([""]),
    fail: {},
    files: new Map(),
};

export const resetServer = (): void => {
    server.files.clear();
    server.dirs = new Set([""]);
    server.fail = {};
};

const normalize = (path: string): string => path.replaceAll(/^\/+|\/+$/gu, "");
const parent = (path: string): string => path.split("/").slice(0, -1).join("/");
const ftpError = (code: number, message: string): Error => Object.assign(new Error(`${String(code)} ${message}`), { code });

const check = (method: string): void => {
    const error = server.fail[method] ?? server.fail["*"];

    if (error) {
        throw error;
    }
};

const read = (path: string): Buffer => {
    const file = server.files.get(normalize(path));

    if (!file) {
        throw ftpError(550, "File unavailable");
    }

    return file.body;
};

export class Client {
    // eslint-disable-next-line class-methods-use-this
    public async access(): Promise<void> {
        check("access");
    }

    // eslint-disable-next-line class-methods-use-this
    public close(): void {}

    // eslint-disable-next-line class-methods-use-this
    public async cd(): Promise<void> {}

    // eslint-disable-next-line class-methods-use-this
    public async ensureDir(path: string): Promise<void> {
        let current = "";

        for (const segment of normalize(path).split("/")) {
            current = current ? `${current}/${segment}` : segment;
            server.dirs.add(current);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public async uploadFrom(source: Readable, path: string): Promise<void> {
        check("uploadFrom");

        if (!server.dirs.has(parent(normalize(path)))) {
            throw ftpError(553, "Could not create file");
        }

        const chunks: Buffer[] = [];

        for await (const chunk of source) {
            chunks.push(Buffer.from(chunk as Uint8Array));
        }

        server.files.set(normalize(path), { body: Buffer.concat(chunks), modifiedAt: new Date() });
    }

    // eslint-disable-next-line class-methods-use-this
    public async downloadTo(destination: Writable, path: string, startAt = 0): Promise<void> {
        check("downloadTo");

        const body = read(path).subarray(startAt);

        await new Promise<void>((resolve, reject) => {
            destination.on("error", reject);
            destination.on("finish", resolve);
            destination.end(body);
        });
    }

    // eslint-disable-next-line class-methods-use-this
    public async remove(path: string): Promise<void> {
        check("remove");
        read(path);
        server.files.delete(normalize(path));
    }

    // eslint-disable-next-line class-methods-use-this
    public async rename(from: string, to: string): Promise<void> {
        check("rename");

        const file = server.files.get(normalize(from));

        if (!file) {
            throw ftpError(550, "File unavailable");
        }

        server.files.set(normalize(to), file);
        server.files.delete(normalize(from));
    }

    // eslint-disable-next-line class-methods-use-this
    public async size(path: string): Promise<number> {
        check("size");

        return read(path).length;
    }

    // eslint-disable-next-line class-methods-use-this
    public async list(path: string): Promise<{ isDirectory: boolean; isFile: boolean; modifiedAt?: Date; name: string; size: number }[]> {
        check("list");

        const directory = normalize(path === "." ? "" : path);

        if (!server.dirs.has(directory)) {
            throw ftpError(550, "No such directory");
        }

        const children = (name: string): boolean => name !== directory && parent(name) === directory;
        const base = (name: string): string => name.split("/").pop() as string;

        return [
            ...[...server.dirs]
                .filter((name) => children(name))
                .map((name) => {
                    return { isDirectory: true, isFile: false, name: base(name), size: 0 };
                }),
            ...[...server.files]
                .filter(([name]) => children(name))
                .map(([name, file]) => {
                    return { isDirectory: false, isFile: true, modifiedAt: file.modifiedAt, name: base(name), size: file.body.length };
                }),
            // A symlink-like entry that is neither file nor directory is skipped.
            { isDirectory: false, isFile: false, name: "link", size: 0 },
        ];
    }
}
