import terminalSize from "term-size";

const windows = process.platform.startsWith("win");

const clear = (): void => {
    let stdout = "";

    if (windows) {
        const { rows } = terminalSize();

        let index;

        // eslint-disable-next-line no-plusplus,no-loops/no-loops
        for (index = 0; index < rows; index++) {
            stdout += "\r\n";
        }
    } else {
        stdout += "\u001B[2J";
    }

    // Reset cursor
    stdout += "\u001B[0f";

    process.stdout.write(stdout);
};

export default clear;
