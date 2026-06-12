import { stdout } from "node:process";

import { createPail } from "@visulima/pail/browser";
import { JsonReporter } from "@visulima/pail/reporter/json";

// `warning` is an RFC 5424 stderr level. Route both the reporter's stderr stream and
// the logger's stderr option to stdout so the integration harness, which captures
// stdout, can read the emitted JSON line (the server pail re-applies its stderr stream
// onto reporters, so the option is what wins there).
const reporter = new JsonReporter();
reporter.setStderr(stdout);

const pail = createPail({
    reporters: [reporter],
    stderr: stdout,
});

pail.warn("esm");
