import { pail } from "@visulima/pail";

const newError = new Error("New Error");

pail.error(
    new Error("Hello World!", {
        cause: newError,
    }),
);

pail.trace("test");
