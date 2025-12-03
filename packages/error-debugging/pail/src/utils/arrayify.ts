const arrayify = <T>(x: T | T[]): T[] => {
    if (x === undefined) {
        return [] as T[];
    }

    return Array.isArray(x) ? x : ([x] as T[]);
};

export default arrayify;
