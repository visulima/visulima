import { createServer } from "node:http";

import { createRouter } from "../src";

function one(request, response, next) {
    request.one = true;
    next();
}

function two(request, response, next) {
    request.two = true;
    next();
}

createServer(
    createRouter()
        .use(one, two)
        .get("/", (request, response) => response.end("Hello"))
        .get("/user/:id", (request, response) => {
            response.end(`User: ${request.params.id}`);
        })
        .handler(),
).listen(3000);
