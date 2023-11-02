/**
 * See https://github.com/anolilab/cerebro#supported-nodejs-versions for our
 * version support policy. The CEREBRO_MIN_NODE_VERSION is used for testing only.
 */
const checkNodeVersion = (): void => {
    const minNodeVersion = process.env["CEREBRO_MIN_NODE_VERSION"] ? Number(process.env["CEREBRO_MIN_NODE_VERSION"]) : 18;

    const nodeVersion = process.version.replace("v", "");

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const major = Number(/v([^.]+)/.exec(process.version)![1]);

    if (major < minNodeVersion) {
        // eslint-disable-next-line no-console
        console.log(
            `cerebro supports a minimum Node version of ${minNodeVersion}. You have ${nodeVersion}. Read our version support policy: https://github.com/visulima/visulima#supported-nodejs-versions`,
        );
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(1);
    }
};

export default checkNodeVersion;
