const customizer = (objectValue: unknown, sourceValue: unknown[]): unknown[] | undefined => {
    if (Array.isArray(objectValue)) {
        return [...objectValue, ...sourceValue] as unknown[];
    }

    return undefined;
};

export default customizer;
