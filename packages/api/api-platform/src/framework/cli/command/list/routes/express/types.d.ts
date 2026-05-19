// eslint-disable-next-line e18e/ban-dependencies -- type-only import; express is a supported integration target for the route-listing CLI
import type { Router } from "express";

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

export interface Route {
    metadata?: unknown;
    path: RegExp | string | (RegExp | string)[];
    stack: Layer[];
}

export interface Layer {
    handle?: Route | Router;
    method?: string;
    name: string;
    route?: Route;
    slash?: boolean;
}
