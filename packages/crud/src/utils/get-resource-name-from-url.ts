export const ensureCamelCase = (string_: string) => `${string_.charAt(0).toLowerCase()}${string_.slice(1)}`;

export const getResourceNameFromUrl = <M extends string = string>(url: string, models: { [key in M]?: string }) => {
    // Exclude the query params from the path
    const realPath = url.split("?")[0];

    if (realPath === undefined) {
        throw new TypeError("Path is undefined");
    }

    const modelName = (Object.keys(models) as M[]).find((name) => {
        const routeName = models[name] as string;
        const camelCaseModel = ensureCamelCase(routeName);

        // eslint-disable-next-line @rushstack/security/no-unsafe-regexp
        return new RegExp(`(${routeName}|${camelCaseModel}$)|(${routeName}|${camelCaseModel}/)`, "g").test(realPath);
    });

    return {
        modelName,
        resourceName: models[modelName] as string,
    };
};
