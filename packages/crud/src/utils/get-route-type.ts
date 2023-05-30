import { match } from "path-to-regexp";

import { RouteType } from "../types.d";

type PathMatch = { id: string };

const getRouteType: (method: string, url: string, resourceName: string) => GetRouteType = (method, url, resourceName) => {
    // Exclude the query params from the path
    const realPath = url.split("?")[0];

    if (realPath === undefined) {
        throw new TypeError("Path is undefined");
    }

    if (!realPath.includes(`/${resourceName}`)) {
        throw new Error(`invalid resource name '${resourceName}' for route '${realPath}'`);
    }

    const entityMatcher = match<PathMatch>([`/(.*)/${resourceName}`, `/(.*)/${resourceName}/:id`], { decode: decodeURIComponent });
    const simpleMatcher = match(`/(.*)/${resourceName}`, {
        decode: decodeURIComponent,
    });

    switch (method) {
        case "GET": {
            const pathMatch = entityMatcher(realPath);

            // If we got a /something after the resource name, we are reading 1 entity
            if (typeof pathMatch === "object" && pathMatch.params.id) {
                return {
                    routeType: RouteType.READ_ONE,
                    resourceId: pathMatch.params.id,
                };
            }

            return {
                routeType: RouteType.READ_ALL,
            };
        }
        case "POST": {
            const pathMatch = simpleMatcher(realPath);

            if (pathMatch) {
                return {
                    routeType: RouteType.CREATE,
                };
            }

            return {
                routeType: null,
            };
        }
        case "PUT":
        case "PATCH": {
            const pathMatch = entityMatcher(realPath);

            if (typeof pathMatch === "object" && pathMatch.params.id) {
                return {
                    routeType: RouteType.UPDATE,
                    resourceId: pathMatch.params.id,
                };
            }

            return {
                routeType: null,
            };
        }
        case "DELETE": {
            const pathMatch = entityMatcher(realPath);

            if (typeof pathMatch === "object" && pathMatch.params.id) {
                return {
                    routeType: RouteType.DELETE,
                    resourceId: pathMatch.params.id,
                };
            }

            return {
                routeType: null,
            };
        }
        default: {
            return {
                routeType: null,
            };
        }
    }
};

export type GetRouteType = {
    routeType: RouteType | null;
    resourceId?: string;
};

export default getRouteType;
