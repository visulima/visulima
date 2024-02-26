import { pail } from "@visulima/pail";

console.log("\n");

const systemLogger = pail.scope("system");
systemLogger.success("Hello from system logger");

const childLogger = systemLogger.child("net");
childLogger.success("Hello from child logger");
