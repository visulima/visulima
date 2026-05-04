type RouteMap<M extends string> = { [key in M]?: string };

const modelsToRouteNames = <M extends string = string>(mappingsMap: Record<string, object>, models: M[]): RouteMap<M> => {
    const routesMap: RouteMap<M> = {};

    models.forEach((model) => {
        routesMap[model] = (mappingsMap[model] as { plural: string }).plural;
    });

    return routesMap;
};

export default modelsToRouteNames;
