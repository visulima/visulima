import { RouteType } from "../../types.d";

const generatePathByRouteType = (resourceName: string, routeType: RouteType) => {
    switch (routeType) {
        case RouteType.CREATE:
        case RouteType.READ_ALL: {
            return `/${resourceName}`;
        }
        case RouteType.READ_ONE:
        case RouteType.UPDATE:
        case RouteType.DELETE: {
            return `/${resourceName}/id`;
        }
    }
};

export default generatePathByRouteType;
