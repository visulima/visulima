// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const isBrowser = globalThis?.window?.document !== undefined;

export const isTerminalApp = !isBrowser && process.env.TERM_PROGRAM === 'Apple_Terminal';
export const isWindows = !isBrowser && process.platform === 'win32';
