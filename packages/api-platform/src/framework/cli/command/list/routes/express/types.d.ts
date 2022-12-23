// eslint-disable-next-line import/no-extraneous-dependencies
import type { IRoute, PathParams } from "@types/express-serve-static-core";
// eslint-disable-next-line import/no-extraneous-dependencies
import { Router } from "express";

export interface Route extends IRoute {
    stack: Layer[];
    metadata?: any;
    name: string;
}

export interface Layer {
    handle?: Route | Router;
    stack: Layer[];
    route: Route;
    name: string;
    params?: PathParams;
    path?: string;
    keys: Key[];
    regexp: ExpressRegex;
    method: string;
}

export interface ExpressRegex extends RegExp {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    fast_slash: boolean;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    fast_star: boolean;
}

export interface RouteMetaData {
    path: string;
    pathParams: Parameter[];
    method: string;
    metadata?: any;
}

export interface Parameter {
    in: string;
    name: string;
    required: boolean;
    [key: string]: any;
}

export interface Key {
    name: string;
    optional: boolean;
    offset: number;
}
