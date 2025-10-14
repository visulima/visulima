import Benchmark from "benchmark";
import chalk from "chalk";

/**
 *
 * @typedef {object} BenchOptions
 * @property {number?} minNameWidth Minimal width of the name.
 *   The name string pads with space until the resulting string reaches the given width.
 * @property {number?} minOpsWidth Minimal width of the ops (Operations Pro Seconds).
 *   The ops string pads with space until the resulting string reaches the given width.
 * @property {StyleFunction?} suiteNameColor The color of suite name.
 * @property {StyleFunction?} benchNameColor The color of benchmark name.
 * @property {StyleFunction?} statUnitColor The color of statistic units.
 * @property {StyleFunction?} opsColor The color of ops value.
 * @property {StyleFunction?} rmeColor The color of relative margin of error (expressed as a percentage of the mean) value.
 * @property {StyleFunction?} failColor The color of fail string.
 */
const defaultOptions = {
    benchNameColor: chalk.visible,
    failColor: chalk.red.bold,
    minNameWidth: 15,
    minOpsWidth: 15,
    opsColor: chalk.cyanBright,
    rmeColor: chalk.visible,
    statUnitColor: chalk.visible,
    suiteNameColor: chalk.yellow.underline,
};
const errors = {};

/**
 * @param {Event} event
 */
let showResult = function (event) {
    const { benchNameColor, failColor, minNameWidth, minOpsWidth, opsColor, rmeColor, statUnitColor } = this.options;
    const { error, hz, stats } = event.target;
    const name = getName(event);
    // <count> runs sampled
    const count = stats.sample.length;
    const ops = (hz.toFixed(hz < 100 ? 2 : 0) * 1).toLocaleString().padStart(minOpsWidth);
    const rme = stats.rme.toFixed(2);
    const plusminus = "\u00B1";
    const namePadding = Math.max(minNameWidth, this.maxNameWidth) + 1;

    let statsString = "";

    statsString = error
        ? failColor(`FAIL`.padStart(minOpsWidth))
        : `${opsColor(ops)} ${statUnitColor("ops/sec")} ${plusminus} ${rmeColor(rme)}${statUnitColor("%")} `;

    process.stdout.write(`\u001B[G${benchNameColor(name.padEnd(namePadding))} ${statsString}`);
};

const getName = (event) => event.target.name || (isNaN(event.target.id) ? event.target.id : `<Test #${event.target.id}>`);

const onComplete = (event) => {
    const { error } = event.target;

    if (!error) {
        showResult(event);
    }

    process.stdout.write(`\n`);
};

const onError = function (event) {
    const { error, name } = event.target;

    errors[name] = error;
};

class Bench {
    benchNames = [];

    maxNameWidth = 0;

    name = "Bench";

    /**
     * @param {BenchOptions} options
     * @returns {function(suiteName: string): Bench}
     */
    constructor(options = {}) {
        this.options = Object.assign(defaultOptions, options);
        showResult = showResult.bind(this);

        return (suiteName) => {
            if (suiteName)
                this.name = suiteName;

            this.suite = new Benchmark.Suite(suiteName);

            return this;
        };
    }

    /**
     * Add the benchmark to suite.
     * @param {string} name The name of benchmark.
     * @param {Function} fn The function of benchmark.
     * @param function_
     * @returns {Bench}
     */
    add(name, function_) {
        this.benchNames.push(name);
        this.suite.add(name, {
            fn: function_,
            onComplete,
            onCycle: showResult,
            onError,
            onStart: () => {},
        });

        return this;
    }

    /**
     * Run all benchmark from the suite.
     */
    run() {
        const { suiteNameColor } = this.options;

        this.maxNameWidth = Math.max(...this.benchNames.map((name) => name.length));
        this.benchNames = [];

        console.log(`\n${suiteNameColor(this.name)}`);
        this.suite.run({ async: false });
    }
}

export default Bench;
