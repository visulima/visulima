import type { Toolbox as IToolbox } from "./@types/toolbox";

class EmptyToolbox implements Partial<IToolbox> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [x: string]: any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public result: any;

    public argv?: IToolbox["argv"];

    public options?: IToolbox["options"];

    public argument?: IToolbox["argument"];

    public command: IToolbox["command"];

    public commandName: IToolbox["commandName"];

    public runtime?: IToolbox["runtime"];

    public logger?: IToolbox["logger"];

    public constructor(commandName: IToolbox["commandName"], command: IToolbox["command"]) {
        this.commandName = commandName;
        this.command = command;
    }
}

export default EmptyToolbox;
