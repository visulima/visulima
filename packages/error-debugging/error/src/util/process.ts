interface Process extends Partial<Omit<typeof globalThis.process, "versions">> {
    versions: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- globalThis.process may not exist in browser environments
const rawProcess = (globalThis.process ?? (Object.create(null) as object)) as unknown as Process;

const processShims: Partial<Process> = {
    versions: {},
};

const process: Process = new Proxy(rawProcess, {
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

export default process;
