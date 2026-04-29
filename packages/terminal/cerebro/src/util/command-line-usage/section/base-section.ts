import os from "node:os";

import { bold } from "@visulima/colorize";

class BaseSection {
    protected lines: string[];

    public constructor() {
        this.lines = [];
    }

    public add(line: string): void {
        this.lines.push(line);
    }

    public toString(): string {
        return this.lines.join(os.EOL);
    }

    public header(text: string): void {
        this.add(bold(text));

        this.lines.push("");
    }
}

export default BaseSection;
