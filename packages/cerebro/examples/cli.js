import { Cerebro } from "@visulima/cerebro";
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";

import optionsDefault from "./commands/options-defaults.js";
import optionsConflicts from "./commands/options-conflicts.js";
import optionsCommon from "./commands/options-common.js";
import optionsNegatable from "./commands/options-negatable.js";
import optionsImplies from "./commands/options-implies.js";
import optionsRequired from "./commands/options-required.js";
import optionsBooleanOrValue from "./commands/options-boolean-or-value.js";
import errorSimple from "./commands/error-simple.js";
import errorDetailed from "./commands/error-detailed.js";
import errorCritical from "./commands/error-critical.js";
import errorCustomFormatter from "./commands/error-custom-formatter.js";

const cli = new Cerebro("cerebro");

cli.addPlugin(
    errorHandlerPlugin({
        detailed: true,
    }),
);

// Options commands
optionsCommon(cli);
optionsConflicts(cli);
optionsDefault(cli);
optionsNegatable(cli);
optionsImplies(cli);
optionsRequired(cli);
optionsBooleanOrValue(cli);

// Error handling commands
errorSimple(cli);
errorDetailed(cli);
errorCritical(cli);
errorCustomFormatter(cli);

await cli.run();
