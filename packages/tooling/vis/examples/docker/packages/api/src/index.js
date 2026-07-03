import Fastify from "fastify";

import { greet } from "shared";

const app = Fastify();

app.get("/", async () => ({ message: greet("docker") }));

app.listen({ host: "0.0.0.0", port: 3000 });
