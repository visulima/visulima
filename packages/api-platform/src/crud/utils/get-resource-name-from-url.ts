export const ensureCamelCase = (str: string) => {
    return `${str.charAt(0).toLowerCase()}${str.slice(1)}`;
};

export const getResourceNameFromUrl = <M extends string = string>(url: string, models: { [key in M]?: string }) => {
    // Exclude the query params from the path
    const realPath = url.split("?")[0];

    if (typeof realPath === "undefined") {
        throw new Error("Path is undefined");
    }

    const modelName = (Object.keys(models) as M[]).find((modelName) => {
        const routeName = models[modelName] as string;
        const camelCaseModel = ensureCamelCase(routeName);

        return new RegExp(`(${routeName}|${camelCaseModel}$)|(${routeName}|${camelCaseModel}/)`, "g").test(realPath);
    });

    return {
        modelName,
        resourceName: models[modelName] as string,
    };
};
