import type { Route } from "./types";

const routesGroupBy = (list: Route[], keyGetter: (item: Route) => keyof Route): Map<string, Route[]> => {
    const map = new Map<string, Route[]>();

    list.forEach((item) => {
        const key = keyGetter(item);
        const collection = map.get(key);

        if (collection) {
            collection.push(item);
        } else {
            map.set(key, [item]);
        }
    });

    return map;
};

export default routesGroupBy;
