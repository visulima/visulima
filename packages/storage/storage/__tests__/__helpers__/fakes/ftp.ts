import type { Readable, Writable } from "node:stream";

// In-memory FTP server behind `basic-ftp`'s Client. Install it with
// vi.mock(import("basic-ftp"), async () => import("../__helpers__/fakes/ftp")).

/**
 * In-memory FTP server state: a tree of files and directories (paths without leading slash), uploads
 * into a missing directory are refused like a real server, missing paths answer 550. A connection
 * starts in `home`, the login directory relative paths resolve against. `fail` makes one client
 * method (`*`: every method) throw, to inject server/connection errors.
 */
export const server: { dirs: Set<string>; fail: Record<string, Error>; files: Map<string, { body: Buffer; modifiedAt: Date }>; home: string } = {
    dirs: new Set<string>([""]),
    fail: {},
    files: new Map(),
    home: "",
};

export const resetServer = (): void => {
    server.files.clear();
    server.dirs = new Set([""]);
    server.fail = {};
    server.home = "";
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

export class Client {
    /** Working directory of this connection. */
    private cwd = server.home;

    // eslint-disable-next-line class-methods-use-this
    public async access(): Promise<void> {
        check("access");
    }

    // eslint-disable-next-line class-methods-use-this
    public close(): void {}

    public async pwd(): Promise<string> {
        return `/${this.cwd}`;
    }

    public async cd(path: string): Promise<void> {
        this.cwd = this.resolve(path);
    }

    /** Creates the directories and enters the last one, as basic-ftp does. */
    public async ensureDir(path: string): Promise<void> {
        const target = this.resolve(path);
        let current = "";

        for (const segment of target.split("/")) {
            current = current ? `${current}/${segment}` : segment;
            server.dirs.add(current);
        }

        this.cwd = target;
    }

    public async uploadFrom(source: Readable, path: string): Promise<void> {
        check("uploadFrom");

        const target = this.resolve(path);

        if (!server.dirs.has(parent(target))) {
            throw ftpError(553, "Could not create file");
        }

        const chunks: Buffer[] = [];

        for await (const chunk of source) {
            chunks.push(Buffer.from(chunk as Uint8Array));
        }

        server.files.set(target, { body: Buffer.concat(chunks), modifiedAt: new Date() });
    }

    public async downloadTo(destination: Writable, path: string, startAt = 0): Promise<void> {
        check("downloadTo");

        const body = this.read(path).subarray(startAt);

        await new Promise<void>((resolve, reject) => {
            destination.on("error", reject);
            destination.on("finish", resolve);
            destination.end(body);
        });
    }

    public async remove(path: string): Promise<void> {
        check("remove");
        this.read(path);
        server.files.delete(this.resolve(path));
    }

    public async rename(from: string, to: string): Promise<void> {
        check("rename");

        const file = server.files.get(this.resolve(from));

        if (!file) {
            throw ftpError(550, "File unavailable");
        }

        server.files.set(this.resolve(to), file);
        server.files.delete(this.resolve(from));
    }

    public async size(path: string): Promise<number> {
        check("size");

        return this.read(path).length;
    }

    public async list(path = ""): Promise<{ isDirectory: boolean; isFile: boolean; modifiedAt?: Date; name: string; size: number }[]> {
        check("list");

        const directory = this.resolve(path);

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

    /** A server path: absolute from the root, otherwise from the working directory. */
    private resolve(path: string): string {
        const relative = normalize(path === "." ? "" : path);

        if (path.startsWith("/") || !this.cwd) {
            return relative;
        }

        return relative ? `${this.cwd}/${relative}` : this.cwd;
    }

    private read(path: string): Buffer {
        const file = server.files.get(this.resolve(path));

        if (!file) {
            throw ftpError(550, "File unavailable");
        }

        return file.body;
    }
}
