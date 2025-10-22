import type { Server } from "@hapi/hapi";
import Hapi from "@hapi/hapi";
import Router from "@koa/router";
import type { Express } from "express";
import express from "express";
import type { FastifyInstance } from "fastify";
import fastify from "fastify";
import Koa from "koa";
import { beforeEach, describe, expect, it } from "vitest";

import { getRoutes } from "../../../../../src/framework/cli/command/list/get-routes";

describe(getRoutes, () => {
    describe(express, () => {
        let app: Express;

        beforeEach(() => {
            app = express();

            app.get("/", (_request, response) => response.sendStatus(200));
            app.get("/activity", (_request, response) => response.sendStatus(200));

            app.get("/activity/:id", (_request, response) => response.sendStatus(200));

            app.get("/users", (_request, response) => response.sendStatus(200));

            app.get("/users/:id", (_request, response) => response.sendStatus(200));
            app.put("/users/:id", (_request, response) => response.sendStatus(200));

            app.get("/users/following", (_request, response) => response.sendStatus(200));
        });

        it("express Routes", async () => {
            expect.assertions(1);

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

        it("koa Routes", async () => {
            expect.assertions(1);

            const actualRoutesMap = await getRoutes(app, "koa", false);

            expect(actualRoutesMap).toMatchSnapshot();
        });
    });

    describe("hapi", () => {
        let app: Server;

        beforeEach(() => {
            app = Hapi.server({
                host: "localhost",
                port: 8080,
            });

            app.route({
                handler: () => null,
                method: "GET",
                path: "/",
            });

            app.route({
                handler: () => null,
                method: "GET",
                path: "/activity",
            });

            app.route({
                handler: () => null,
                method: "GET",
                path: "/activity/:id",
            });

            app.route({
                handler: () => null,
                method: "GET",
                path: "/users",
            });

            app.route({
                handler: () => null,
                method: ["GET", "PUT"],
                path: "/users/:id",
            });

            app.route({
                handler: () => null,
                method: "GET",
                path: "/users/following",
            });
        });

        it("hapi Routes", async () => {
            expect.assertions(1);

            const actualRoutesMap = await getRoutes(app, "hapi", false);

            expect(actualRoutesMap).toMatchSnapshot();
        });
    });

    describe(fastify, () => {
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

        it("fastify Routes", async () => {
            expect.assertions(1);

            const actualRoutesMap = await getRoutes(app, "fastify", false);

            expect(actualRoutesMap).toMatchSnapshot();
        });
    });
});
