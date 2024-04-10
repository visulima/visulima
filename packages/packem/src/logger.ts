import { createPail } from "@visulima/pail";

const logger = createPail({
    scope: "packem",
});

// logger.wrapAll();

export default logger;
