const customizer = (objectValue: unknown, sourceValue: Array<unknown>): unknown[] | undefined => {
    if (Array.isArray(objectValue)) {
        return [...objectValue, ...sourceValue];
    }
    // eslint-disable-next-line unicorn/no-useless-undefined
    return undefined;
};

export default customizer;
