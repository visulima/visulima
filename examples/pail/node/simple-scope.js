import { createPail } from "@visulima/pail";

console.log("\n");

const mayAppLogger = createPail({
    scope: "my-app",
});

mayAppLogger.info("Hello from my app");

const mayAppLogger2 = mayAppLogger.scope("my-app-2");

mayAppLogger2.info("Hello from my app");
