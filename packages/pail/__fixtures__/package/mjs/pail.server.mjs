import { createPail } from "@visulima/pail";
import { JsonReporter } from "@visulima/pail/reporter";

const pail = createPail({
    reporters: [new JsonReporter()],
});

pail.warn("esm");
