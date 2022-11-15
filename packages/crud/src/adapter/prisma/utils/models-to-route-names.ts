const modelsToRouteNames = <M extends string = string>(mappingsMap: { [key: string]: object }, models: M[]) => {
    const routesMap: { [key in M]?: string } = {};

    models?.forEach((model) => {
        // @ts-ignore
        routesMap[model] = mappingsMap[model].plural;
    });

    return routesMap;
};

export default modelsToRouteNames;
