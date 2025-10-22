import { createPail } from "@visulima/pail/browser";
import { JsonReporter } from "@visulima/pail/reporter/json";

const pail = createPail({
    reporters: [new JsonReporter()],
});

pail.warn("esm");
