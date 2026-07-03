import type { Command, CreateOptions } from "@visulima/cerebro";
import { lazyNamed } from "@visulima/cerebro";

const targetIdArgument = {
    description: "Target id, e.g. @my/api:db",
    name: "targetId",
    type: String,
} as const;

const formatOption = {
    description: "Output format: table or json (default: table)",
    name: "format",
    type: String,
} as const;

const serviceStart: Command = {
    argument: targetIdArgument,
    commandPath: ["service"],
    description: "Start a service target detached so it survives across `vis run` invocations",
    examples: [
        ["vis service start @my/api:db", "Boot the db target as a long-lived service"],
        ["vis service start @my/api:db --timeout=60000", "Override readiness timeout"],
        ["vis service start @my/api:db --no-readiness", "Skip the readiness probe"],
    ],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "serviceStartExecute"),
    name: "start",
    options: [
        {
            description: "Readiness probe timeout in milliseconds",
            name: "timeout",
            type: Number,
        },
        {
            defaultValue: false,
            description: "Skip the readiness probe",
            name: "no-readiness",
            type: Boolean,
        },
    ],
};

const serviceStop: Command = {
    argument: {
        description: "Target id to stop, or omit when using --all",
        name: "targetId",
        required: false,
        type: String,
    },
    commandPath: ["service"],
    description: "Stop a running service",
    examples: [
        ["vis service stop @my/api:db", "Stop the db service"],
        ["vis service stop --all", "Stop every running service in this workspace"],
    ],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "serviceStopExecute"),
    name: "stop",
    options: [
        {
            defaultValue: false,
            description: "Stop every service registered for this workspace",
            name: "all",
            type: Boolean,
        },
        {
            description: "Override the SIGTERM→SIGKILL grace period in milliseconds",
            name: "grace-ms",
            type: Number,
        },
    ],
};

const serviceList: Command = {
    commandPath: ["service"],
    description: "List services registered for this workspace",
    examples: [
        ["vis service list", "Print running services"],
        ["vis service list --format=json", "Machine-readable list"],
    ],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "serviceListExecute"),
    name: "list",
    options: [formatOption],
};

const serviceStatus: Command = {
    argument: targetIdArgument,
    commandPath: ["service"],
    description: "Re-run the readiness probe and report a service's health",
    examples: [["vis service status @my/api:db", "Check whether the db service is reachable"]],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "serviceStatusExecute"),
    name: "status",
    options: [
        {
            description: "Probe timeout in milliseconds",
            name: "timeout",
            type: Number,
        },
    ],
};

const serviceRestart: Command = {
    argument: targetIdArgument,
    commandPath: ["service"],
    description: "Stop and re-start a running service",
    examples: [
        ["vis service restart @my/api:db", "Recycle the db service"],
        ["vis service restart @my/api:db --no-readiness", "Recycle and skip the readiness probe"],
    ],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "serviceRestartExecute"),
    name: "restart",
    options: [
        {
            description: "Readiness probe timeout in milliseconds",
            name: "timeout",
            type: Number,
        },
        {
            description: "Override the SIGTERM→SIGKILL grace period in milliseconds",
            name: "grace-ms",
            type: Number,
        },
        {
            defaultValue: false,
            description: "Skip the readiness probe after restart",
            name: "no-readiness",
            type: Boolean,
        },
    ],
};

const serviceLogs: Command = {
    argument: targetIdArgument,
    commandPath: ["service"],
    description: "Print or tail a service's captured stdout/stderr",
    examples: [
        ["vis service logs @my/api:db", "Print the captured log"],
        ["vis service logs @my/api:db -f", "Tail the log (Ctrl-C to exit)"],
    ],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "serviceLogsExecute"),
    name: "logs",
    options: [
        {
            alias: "f",
            defaultValue: false,
            description: "Follow the log file (like `tail -f`)",
            name: "follow",
            type: Boolean,
        },
    ],
};

const serviceCommands: Command[] = [serviceStart, serviceStop, serviceList, serviceStatus, serviceRestart, serviceLogs];

export default serviceCommands;

export type ServiceStartOptions = CreateOptions<{
    "no-readiness": boolean | undefined;
    timeout: number | undefined;
}>;

export type ServiceStopOptions = CreateOptions<{
    all: boolean | undefined;
    "grace-ms": number | undefined;
}>;

export type ServiceListOptions = CreateOptions<{
    format: string | undefined;
}>;

export type ServiceStatusOptions = CreateOptions<{
    timeout: number | undefined;
}>;

export type ServiceRestartOptions = CreateOptions<{
    "grace-ms": number | undefined;
    "no-readiness": boolean | undefined;
    timeout: number | undefined;
}>;

export type ServiceLogsOptions = CreateOptions<{
    follow: boolean | undefined;
}>;
