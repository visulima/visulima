import process from "node:process";

/**
 * Marks a quiescent point for the PTY test: sets the window title to `step:&lt;name>`, then blocks
 * until the test sends a key. See `startFixture` in __tests__/helpers/pty-emulator.ts.
 * @param name The step the test waits for.
 */
const step = async (name: string): Promise<void> => {
    process.stdout.write(`\u001B]0;step:${name}\u0007`);

    // Without raw mode the pty echoes the key the test sends, and that newline would shift the cursor
    // under whatever the renderer writes next.
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
    }

    await new Promise<void>((resolve) => {
        process.stdin.resume();
        process.stdin.once("data", () => {
            resolve();
        });
    });
};

export default step;
