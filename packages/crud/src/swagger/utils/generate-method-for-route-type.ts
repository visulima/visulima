import { RouteType } from "../../types.d";

type HttpMethod = "get" | "post" | "put" | "delete";

const generateMethodForRouteType = (routeType: RouteType): HttpMethod => {
    switch (routeType) {
        case RouteType.CREATE: {
            return "post";
        }
        case RouteType.READ_ALL:
        case RouteType.READ_ONE: {
            return "get";
        }
        case RouteType.UPDATE: {
            return "put";
        }
        case RouteType.DELETE: {
            return "delete";
        }
    }
};

export default generateMethodForRouteType;
