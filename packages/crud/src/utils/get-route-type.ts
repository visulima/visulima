import { match } from "path-to-regexp";

import { RouteType } from "../types.d";

interface PathMatch {
    id: string;
}

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
                    resourceId: pathMatch.params.id,
                    routeType: RouteType.READ_ONE,
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
                    resourceId: pathMatch.params.id,
                    routeType: RouteType.UPDATE,
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
                    resourceId: pathMatch.params.id,
                    routeType: RouteType.DELETE,
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

export interface GetRouteType {
    resourceId?: string;
    routeType: RouteType | null;
}

export default getRouteType;
