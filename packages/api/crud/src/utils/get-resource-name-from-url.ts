export const ensureCamelCase = (string_: string): string => `${string_.charAt(0).toLowerCase()}${string_.slice(1)}`;

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- M provides call-site narrowing for model keys
export const getResourceNameFromUrl = <M extends string = string>(
    url: string,
    models: { [key in M]: string },
): {
    modelName: string;
    resourceName: string;
} => {
    // Exclude the query params from the path
    const realPath = url.split("?")[0];

    if (realPath === undefined) {
        throw new TypeError("Path is undefined");
    }

    const segments = realPath.split("/").filter(Boolean);

    const modelName = (Object.keys(models) as M[]).find((name) => {
        const routeName = models[name];

        // A model configured with an empty route name resolves to a falsy resourceName so the
        // caller can reach its missing-resource branch; treat it as matching any path.
        if (routeName === "") {
            return true;
        }

        return segments.includes(routeName) || segments.includes(ensureCamelCase(routeName));
    });

    if (modelName === undefined) {
        throw new Error(`Couldn't find model name for url ${url}`);
    }

    return {
        modelName,
        resourceName: models[modelName],
    };
};
