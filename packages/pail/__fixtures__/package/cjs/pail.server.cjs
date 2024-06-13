const { createPail } = require("@visulima/pail");
const { JsonReporter } = require("@visulima/pail/reporter");

const pail = createPail({
    reporters: [new JsonReporter()],
});

pail.warn("cjs");
