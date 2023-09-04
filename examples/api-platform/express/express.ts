import express from "express";
import Cors from "cors";
import { handler } from "@visulima/api-platform/openapi";

const PORT = process.env.PORT || 3002;

const app = express();

// Initializing the cors middleware
// You can read more about the available options here: https://github.com/expressjs/cors#configuration-options
const cors = Cors({
    methods: ["POST", "GET", "HEAD", "PATCH", "DELETE", "OPTIONS"],
    preflightContinue: true,
});

app.use(cors);

app.get("/admin", (_request, response) => response.sendStatus(200));
app.get("/admin/members", (_request, response) => response.sendStatus(200));
app.get("/admin/settings", (_request, response) => response.sendStatus(200));

app.get("/users", (_request, response) => response.sendStatus(200));
app.post("/users", (_request, response) => response.sendStatus(200));

app.get("/users/:id", (_request, response) => response.sendStatus(200));
app.patch("/users/:id", (_request, response) => response.sendStatus(200));

app.get("/products", (_request, response) => response.sendStatus(200));
app.post("/products", (_request, response) => response.sendStatus(200));

app.get("/products/:id", (_request, response) => response.sendStatus(200));
app.patch("/products/:id", (_request, response) => response.sendStatus(200));
app.delete("/products/:id", (_request, response) => response.sendStatus(200));

app.get("/blog", (_request, response) => response.sendStatus(200));
app.post("/blog", (_request, response) => response.sendStatus(200));
app.get("/blog/:id", (_request, response) => response.sendStatus(200));
app.patch("/blog/:id", (_request, response) => response.sendStatus(200));
app.delete("/blog/:id", (_request, response) => response.sendStatus(200));

app.use(
    "/api/openapi",
    handler({
        allowedMediaTypes: {
            "application/json": true,
        },
    }),
);

export default app;
