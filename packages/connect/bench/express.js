// eslint-disable-next-line import/no-extraneous-dependencies
import express from "express";

/**
 *
 * @param request
 * @param response
 * @param next
 */
function one(request, response, next) {
    request.one = true;
    next();
}

/**
 *
 * @param request
 * @param response
 * @param next
 */
function two(request, response, next) {
    request.two = true;
    next();
}

express()
    .use(one, two)
    .get("/", (request, response) => response.send("Hello"))
    .get("/user/:id", (request, response) => {
        response.end(`User: ${request.params.id}`);
    })
    .listen(3000);
