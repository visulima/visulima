import { match } from "path-to-regexp";

import { RouteType } from "../types";

const getRouteType = (method: string, url: string, resourceName: string): GetRouteType => {
    // Exclude the query params from the path
    const realPath = url.split("?")[0];

    if (realPath === undefined) {
        throw new TypeError("Path is undefined");
    }

    if (!realPath.includes(`/${resourceName}`)) {
        throw new Error(`invalid resource name '${resourceName}' for route '${realPath}'`);
    }

    const entityMatcher = match(`/*placeholder/${resourceName}{/:id}`, { decode: decodeURIComponent });
    const simpleMatcher = match(`/*placeholder/${resourceName}`, {
        decode: decodeURIComponent,
    });

    switch (method) {
        case "DELETE": {
            const pathMatch = entityMatcher(realPath);

            if (typeof pathMatch === "object" && pathMatch.params.id) {
                return {
                    resourceId: pathMatch.params.id as string,
                    routeType: RouteType.DELETE,
                };
            }

            return {
                routeType: null,
            };
        }
        case "GET": {
            const pathMatch = entityMatcher(realPath);

            console.log(pathMatch);

            // If we got a /something after the resource name, we are reading 1 entity
            if (typeof pathMatch === "object" && pathMatch.params !== null && pathMatch.params.id) {
                return {
                    resourceId: pathMatch.params.id as string,
                    routeType: RouteType.READ_ONE,
                };
            }

            return {
                routeType: RouteType.READ_ALL,
            };
        }
        case "PATCH":
        case "PUT": {
            const pathMatch = entityMatcher(realPath);

            if (typeof pathMatch === "object" && pathMatch.params.id) {
                return {
                    resourceId: pathMatch.params.id as string,
                    routeType: RouteType.UPDATE,
                };
            }

            return {
                routeType: null,
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
