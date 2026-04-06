const customizer = (objectValue: unknown, sourceValue: unknown[]): unknown[] | undefined => {
    if (Array.isArray(objectValue)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        return [...objectValue, ...sourceValue] as unknown[];
    }

    return undefined;
};

export default customizer;
