const arrayify = <T>(x: T | T[]): T[] => {
    // eslint-disable-next-line sonarjs/different-types-comparison -- undefined check needed for runtime safety
    if (x === undefined) {
        return [] as T[];
    }

    return Array.isArray(x) ? x : ([x] as T[]);
};

export default arrayify;
