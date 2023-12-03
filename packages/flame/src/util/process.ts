interface Process extends Partial<Omit<typeof globalThis.process, "versions">> {
    versions: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/no-unnecessary-condition,no-underscore-dangle
const _process = (globalThis.process || Object.create(null)) as unknown as Process;

const processShims: Partial<Process> = {
    versions: {},
};

const process = new Proxy<Process>(_process, {
    get(target, property: keyof Process) {
        if (property in target) {
            // eslint-disable-next-line security/detect-object-injection
            return target[property];
        }

        if (property in processShims) {
            // eslint-disable-next-line security/detect-object-injection
            return processShims[property];
        }

        return undefined;
    },
});

export default process;
