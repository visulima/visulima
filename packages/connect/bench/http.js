import { createServer } from "node:http";

// eslint-disable-next-line consistent-return
createServer((request, response) => {
    request.one = true;
    request.two = true;

    if (request.url === "/") {
        return response.end("Hello");
    }

    if (request.url.startsWith("/user")) {
        return response.end("User: 123");
    }

    response.statusCode = 404;
    response.end("not found");
}).listen(3000);
