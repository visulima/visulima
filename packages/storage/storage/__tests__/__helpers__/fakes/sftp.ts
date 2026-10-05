// Copied from __tests__/storage/sftp/sftp-fake.test.ts so other suites can share it. Install it with
// vi.mock(import("ssh2-sftp-client"), async () => { return { default: (await import("../__helpers__/fakes/sftp")).Client }; }).

/** In-memory SFTP server state; `fail` makes one client method (`*`: every method) throw. */
export const server: { dirs: Set<string>; fail: Record<string, Error>; files: Map<string, { body: Buffer; modifyTime: number }> } = {
    dirs: new Set<string>(["", "/"]),
    fail: {},
    files: new Map(),
};

export const resetServer = (): void => {
    server.files.clear();
    server.dirs = new Set(["", "/"]);
    server.fail = {};
};

const parent = (path: string): string => {
    const index = path.lastIndexOf("/");

    return index === 0 ? "/" : path.slice(0, Math.max(0, index));
};
const noSuchFile = (path: string): Error => Object.assign(new Error(`No such file: ${path}`), { code: 2 });

const check = (method: string): void => {
    const error = server.fail[method] ?? server.fail["*"];

    if (error) {
        throw error;
    }
};

const read = (path: string): Buffer => {
    const file = server.files.get(path);

    if (!file) {
        throw noSuchFile(path);
    }

    return file.body;
};

export class Client {
    // eslint-disable-next-line class-methods-use-this
    public async connect(): Promise<void> {
        check("connect");
    }

    // eslint-disable-next-line class-methods-use-this
    public async end(): Promise<boolean> {
        return true;
    }

    // eslint-disable-next-line class-methods-use-this
    public async mkdir(path: string): Promise<void> {
        for (let current = path; !server.dirs.has(current); current = parent(current)) {
            server.dirs.add(current);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public async put(body: Buffer, path: string): Promise<void> {
        check("put");

        if (!server.dirs.has(parent(path))) {
            throw noSuchFile(parent(path));
        }

        server.files.set(path, { body: Buffer.from(body), modifyTime: Date.now() });
    }

    // eslint-disable-next-line class-methods-use-this
    public async get(path: string, _destination?: unknown, options?: { readStreamOptions?: { end?: number; start?: number } }): Promise<Buffer> {
        check("get");

        const { end, start = 0 } = options?.readStreamOptions ?? {};

        return read(path).subarray(start, end === undefined ? undefined : end + 1);
    }

    // eslint-disable-next-line class-methods-use-this
    public async delete(path: string): Promise<void> {
        check("delete");
        read(path);
        server.files.delete(path);
    }

    // eslint-disable-next-line class-methods-use-this
    public async rename(from: string, to: string): Promise<void> {
        check("rename");

        const body = read(from);

        server.files.set(to, { body, modifyTime: Date.now() });
        server.files.delete(from);
    }

    // eslint-disable-next-line class-methods-use-this
    public async stat(path: string): Promise<{ size: number }> {
        check("stat");

        return { size: read(path).length };
    }

    // eslint-disable-next-line class-methods-use-this
    public async exists(path: string): Promise<false | "-" | "d"> {
        check("exists");

        if (server.files.has(path)) {
            return "-";
        }

        return server.dirs.has(path) ? "d" : false;
    }

    // eslint-disable-next-line class-methods-use-this
    public async list(path: string): Promise<{ modifyTime: number; name: string; size: number; type: string }[]> {
        check("list");

        const directory = path === "." ? "" : path;

        if (!server.dirs.has(directory)) {
            throw noSuchFile(directory);
        }

        const children = (name: string): boolean => name !== directory && name !== "/" && parent(name) === directory;
        const base = (name: string): string => name.slice(name.lastIndexOf("/") + 1);

        return [
            ...[...server.dirs]
                .filter((name) => children(name))
                .map((name) => {
                    return { modifyTime: 0, name: base(name), size: 0, type: "d" };
                }),
            ...[...server.files]
                .filter(([name]) => children(name))
                .map(([name, file]) => {
                    return { modifyTime: file.modifyTime, name: base(name), size: file.body.length, type: "-" };
                }),
            { modifyTime: 0, name: "link", size: 0, type: "l" },
        ];
    }
}
