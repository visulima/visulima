import { RouteType } from "../types";

const getAccessibleRoutes = (only?: RouteType[], exclude?: RouteType[], defaultExposeStrategy: "all" | "none" = "all"): RouteType[] => {
    let accessibleRoutes: RouteType[]
        = defaultExposeStrategy === "none" ? [] : [RouteType.READ_ALL, RouteType.READ_ONE, RouteType.UPDATE, RouteType.DELETE, RouteType.CREATE];

    if (Array.isArray(only)) {
        accessibleRoutes = only;
    }

    if (exclude?.length) {
        accessibleRoutes = accessibleRoutes.filter((element) => !exclude.includes(element));
    }

    return accessibleRoutes;
};

export default getAccessibleRoutes;
