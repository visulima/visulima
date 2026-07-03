import { createPail } from "@visulima/pail";

console.log("\n");

const custom = createPail({
    scope: "custom",
    types: {
        remind: {
            badge: "**",
            color: "yellow",
            label: "reminder",
            logLevel: "informational",
        },
        santa: {
            badge: "🎅",
            color: "red",
            label: "santa",
            logLevel: "informational",
        },
    },
});

custom.remind("Improve documentation.");
custom.santa("Hoho! You have an unused variable on L45.");
custom.info("This is a regular info message.");
