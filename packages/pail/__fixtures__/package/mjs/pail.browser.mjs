import { createPail } from "@visulima/pail/browser";
import { JsonReporter } from "@visulima/pail/browser/reporter";

const pail = createPail({
    reporters: [new JsonReporter()],
});

pail.success("esm");
