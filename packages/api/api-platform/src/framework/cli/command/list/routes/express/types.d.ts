import type { IRoute, PathParams } from "@types/express-serve-static-core";
// eslint-disable-next-line e18e/ban-dependencies -- type-only import; express is a supported integration target for the route-listing CLI
import type { Router } from "express";

export interface ExpressRegex extends RegExp {
    fast_slash: boolean;

    fast_star: boolean;
}

export interface Parameter {
    [key: string]: unknown;
    in: string;
    name: string;
    required: boolean;
}

export interface RouteMetaData {
    metadata?: unknown;
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
    metadata?: unknown;
    name: string;
    stack: Layer[];
}
