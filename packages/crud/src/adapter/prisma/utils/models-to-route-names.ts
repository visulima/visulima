type RouteMap<M extends string> = { [key in M]?: string };

const modelsToRouteNames = <M extends string = string>(mappingsMap: Record<string, object>, models: M[]): RouteMap<M> => {
    const routesMap: RouteMap<M> = {};

    models.forEach((model) => {
        // @ts-expect-error - This is a private property, but it's the only way to get the plural name
        routesMap[model as M] = mappingsMap[model as M].plural;
    });

    return routesMap;
};

export default modelsToRouteNames;
