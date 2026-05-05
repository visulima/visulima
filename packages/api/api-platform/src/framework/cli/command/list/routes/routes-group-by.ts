import type { Route } from "./types";

const routesGroupBy = (list: Route[], keyGetter: (item: Route) => string | undefined): Map<string, Route[]> => {
    const map = new Map<string, Route[]>();

    list.forEach((item) => {
        const key = keyGetter(item) ?? "unsorted";
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
