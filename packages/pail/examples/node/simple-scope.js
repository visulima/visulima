import { createPail } from "@visulima/pail";

console.log("\n");

const mayAppLogger = createPail({
    scope: "my-app",
});

mayAppLogger.info("Hello from my app");
