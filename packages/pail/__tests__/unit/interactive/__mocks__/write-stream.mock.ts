class WriteStream {
    private static readonly COLUMNS = 80;

    private static readonly ROWS = 12;

    public columns: number;

    public rows: number;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public _stack: any[] = [];

    public constructor(columns: number = WriteStream.COLUMNS, rows: number = WriteStream.ROWS) {
        this.columns = columns;
        this.rows = rows;
    }

    public clear(): void {
        this._stack = [];
    }

    public write(string_: string): boolean {
        return !!this._stack.push(...typeof string_ === "string" ? string_.split("\n") : [string_]);
    }
}

export default WriteStream;
