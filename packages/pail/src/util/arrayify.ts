const arrayify = <T>(x: T | T[]): T[] => {
    if (x === undefined) {
        return [] as any[];
    }

    return Array.isArray(x) ? x : [x];
};

export default arrayify;
