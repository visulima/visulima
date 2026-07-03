import { pail } from "@visulima/pail";

pail.wrapConsole();

console.log("This is a regular console log", "test 2");

console.log("text and error", new Error("This is an error"), "test2", new Error("This is another error"));

console.log(
    "text and object",
    {
        key: "value",
        key2: "value2",
        key3: "value3",
    },
    "more text",
);

console.log("text and array", ["value", "value2", "value3"], "more text");
