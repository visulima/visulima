type RouteMap<M extends string> = { [key in M]?: string };

const modelsToRouteNames = <M extends string = string>(mappingsMap: Record<M, Record<"name" | "plural", string>>, models: M[]): RouteMap<M> => {
    const routesMap: RouteMap<M> = {};

    models.forEach((model) => {
        routesMap[model as M] = mappingsMap[model as M].plural;
    });

    return routesMap;
};

export default modelsToRouteNames;
