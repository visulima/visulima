// eslint-disable-next-line import/no-extraneous-dependencies
import type { Server } from "@hapi/hapi";
import Hapi from "@hapi/hapi";
// eslint-disable-next-line import/no-extraneous-dependencies
import Router from "@koa/router";
// eslint-disable-next-line import/no-extraneous-dependencies
import type { Express } from "express";
import express from "express";
// eslint-disable-next-line import/no-extraneous-dependencies
import type { FastifyInstance } from "fastify";
// eslint-disable-next-line import/no-extraneous-dependencies
import fastify from "fastify";
// eslint-disable-next-line import/no-extraneous-dependencies
import Koa from "koa";
import {
    beforeEach, describe, expect, it,
} from "vitest";

import { getRoutes } from "../../../../../src/framework/cli/command/list/get-routes";

describe("getRoutes", () => {
    describe("express", () => {
        let app: Express;

        beforeEach(() => {
            app = express();

            app.get("/", (_request, response) => response.sendStatus(200));
            app.get("/activity", (_request, response) => response.sendStatus(200));
            // eslint-disable-next-line radar/no-duplicate-string
            app.get("/activity/:id", (_request, response) => response.sendStatus(200));

            // eslint-disable-next-line radar/no-duplicate-string
            app.get("/users", (_request, response) => response.sendStatus(200));
            // eslint-disable-next-line radar/no-duplicate-string
            app.get("/users/:id", (_request, response) => response.sendStatus(200));
            app.put("/users/:id", (_request, response) => response.sendStatus(200));
            // eslint-disable-next-line radar/no-duplicate-string
            app.get("/users/following", (_request, response) => response.sendStatus(200));
        });

        it("Express Routes", async () => {
            const actualRoutesMap = await getRoutes(app, "express", false);

            expect(actualRoutesMap).toMatchSnapshot();
        });
    });

    describe("koa", () => {
        let app: Koa;
        let router: Router;

        beforeEach(() => {
            app = new Koa();
            router = new Router();

            router.get("/", () => {});
            router.get("/activity", () => {});
            router.get("/activity/:id", () => {});

            router.get("/users", () => {});
            router.get("/users/:id", () => {});
            router.put("/users/:id", () => {});
            router.get("/users/following", () => {});

            app.use(router.routes());
            // eslint-disable-next-line no-console
            app.use(() => console.log("Non-router middleware"));
        });

        it("Koa Routes", async () => {
            const actualRoutesMap = await getRoutes(app, "koa", false);

            expect(actualRoutesMap).toMatchSnapshot();
        });
    });

    describe("hapi", () => {
        let app: Server;

        beforeEach(() => {
            app = Hapi.server({
                port: 8080,
                host: "localhost",
            });

            app.route({
                method: "GET",
                path: "/",
                handler: () => null,
            });

            app.route({
                method: "GET",
                path: "/activity",
                handler: () => null,
            });

            app.route({
                method: "GET",
                path: "/activity/:id",
                handler: () => null,
            });

            app.route({
                method: "GET",
                path: "/users",
                handler: () => null,
            });

            app.route({
                method: ["GET", "PUT"],
                path: "/users/:id",
                handler: () => null,
            });

            app.route({
                method: "GET",
                path: "/users/following",
                handler: () => null,
            });
        });

        it("Hapi Routes", async () => {
            const actualRoutesMap = await getRoutes(app, "hapi", false);

            expect(actualRoutesMap).toMatchSnapshot();
        });
    });

    describe("fastify", () => {
        let app: FastifyInstance;

        beforeEach(() => {
            app = fastify();

            app.get("/", (_request, response) => response.status(200));
            app.get("/activity", (_request, response) => response.status(200));
            app.get("/activity/:id", (_request, response) => response.status(200));

            app.get("/users", (_request, response) => response.status(200));
            app.get("/users/:id", (_request, response) => response.status(200));
            app.put("/users/:id", (_request, response) => response.status(200));
            app.get("/users/following", (_request, response) => response.status(200));
        });

        it("Fastify Routes", async () => {
            const actualRoutesMap = await getRoutes(app, "fastify", false);

            expect(actualRoutesMap).toMatchSnapshot();
        });
    });
});
