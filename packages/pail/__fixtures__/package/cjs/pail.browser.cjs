const { createPail } = require("@visulima/pail/browser");
const { JsonReporter } = require("@visulima/pail/browser/reporter");

const pail = createPail({
    reporters: [new JsonReporter()],
});

pail.success("cjs");
