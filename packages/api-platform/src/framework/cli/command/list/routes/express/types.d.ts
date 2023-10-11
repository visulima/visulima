import type { IRoute, PathParams } from "@types/express-serve-static-core";
import type { Router } from "express";

export interface ExpressRegex extends RegExp {
    fast_slash: boolean;

    fast_star: boolean;
}

export interface Parameter {
    [key: string]: any;
    in: string;
    name: string;
    required: boolean;
}

export interface RouteMetaData {
    metadata?: any;
    method: string;
    path: string;
    pathParams: Parameter[];
}
export interface Key {
    name: string;
    offset: number;
    optional: boolean;
}

export interface Layer {
    handle?: Route | Router;
    keys: Key[];
    method: string;
    name: string;
    params?: PathParams;
    path?: string;
    regexp: ExpressRegex;

    route?: Route;
    stack: Layer[];
}

export interface Route extends IRoute {
    metadata?: any;
    name: string;
    stack: Layer[];
}
