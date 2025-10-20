import { createPail } from "@visulima/pail";
import { MessageFormatterProcessor, ErrorProcessor, CallerProcessor } from "@visulima/pail/processor";

const pail = createPail({
    logLevel: "debug",
    processors: [new MessageFormatterProcessor(), new ErrorProcessor(), new CallerProcessor()],
});

pail.debug("test");
