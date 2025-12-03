interface Process extends Partial<Omit<typeof globalThis.process, "versions">> {
    versions: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const _process = (globalThis.process || Object.create(null)) as unknown as Process;

const processShims: Partial<Process> = {
    versions: {},
};

const process: Process = new Proxy<Process>(_process, {
    get(target, property: keyof Process) {
        if (property in target) {
            return target[property];
        }

        if (property in processShims) {
            return processShims[property];
        }

        return undefined;
    },
});

// Cache expensive process properties for performance
let cachedVersion: string | undefined;
let cachedPlatform: string | undefined;

export const getProcessVersion = (): string => {
    if (cachedVersion === undefined) {
        cachedVersion = process.version || "";
    }

    return cachedVersion;
};

export const getProcessPlatform = (): string => {
    if (cachedPlatform === undefined) {
        cachedPlatform = process.platform || "";
    }

    return cachedPlatform;
};

export default process;
