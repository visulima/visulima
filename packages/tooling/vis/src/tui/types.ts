export interface StdinEntry {
    /** Kill the child process/PTY. */
    kill?: (signal?: string) => void;
    /** Resize the child's PTY (only available for PTY-backed processes). */
    resize?: (cols: number, rows: number) => void;
    /** Write data to the child's stdin or PTY. */
    write: (data: string) => void;
}
