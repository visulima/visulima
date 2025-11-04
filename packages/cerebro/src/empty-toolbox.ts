import type { Toolbox as IToolbox } from "./types/toolbox";

class EmptyToolbox implements Partial<IToolbox> {
    [x: string]: unknown;

    public result: unknown;

    public argv?: IToolbox["argv"];

    public options?: IToolbox["options"];

    public argument?: IToolbox["argument"];

    public command: IToolbox["command"];

    public commandName: IToolbox["commandName"];

    public env?: IToolbox["env"];

    public logger?: IToolbox["logger"];

    public runtime?: IToolbox["runtime"];

    public constructor(commandName: IToolbox["commandName"], command: IToolbox["command"]) {
        this.commandName = commandName;
        this.command = command;
    }
}

export default EmptyToolbox;
