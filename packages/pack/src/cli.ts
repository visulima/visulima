import Cli from "@visulima/cerebro";

import { name, version } from "../package.json";

const cli = new Cli("pack", {
    packageName: name,
    packageVersion: version,
});

await cli.run();
