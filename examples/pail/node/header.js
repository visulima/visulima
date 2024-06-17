import { createPail } from "@visulima/pail";

console.log("------------------ HEADER ------------------", "\n");

const pail = createPail({
    scope: "pail",
    types: {
        santa: {
            badge: "🎅 ",
            color: "red",
            label: "santa",
            logLevel: "informational",
        },
    },
});

pail.success("Cleaned up the code.");
pail.error("Unable to process the request.");
pail.warn("Function is deprecated.");
pail.await("Vectoroizing the dataset...");
pail.start("Initializing the compiling process...");
pail.wait("Compiling process is waiting...");
pail.stop("Compiling process was stopped.");
pail.santa("Hoho! You have an unused variable on L45.");
pail.info("This is a regular info message.");
pail.trace("This is a trace message.");
