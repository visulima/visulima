type RouteMap<M extends string> = { [key in M]?: string };

const modelsToRouteNames = <M extends string = string>(mappingsMap: Record<string, object>, models: M[]): RouteMap<M> => {
    const routesMap: RouteMap<M> = {};

    models.forEach((model) => {
        // @ts-expect-error
        routesMap[model] = mappingsMap[model].plural;
    });

    return routesMap;
};

export default modelsToRouteNames;
