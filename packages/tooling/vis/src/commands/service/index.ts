import type { AnyCommandInput, Command, CreateOptions, InferOptions } from "@visulima/cerebro";
import { defineCommand, lazyNamed } from "@visulima/cerebro";

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

const serviceStartOptionDefinitions = {
    "no-readiness": {
        defaultValue: false,
        description: "Skip the readiness probe",
        type: Boolean,
    },
    timeout: {
        description: "Readiness probe timeout in milliseconds",
        type: Number,
    },
} as const;

const serviceStart = defineCommand({
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
    options: serviceStartOptionDefinitions,
});

const serviceStopOptionDefinitions = {
    all: {
        defaultValue: false,
        description: "Stop every service registered for this workspace",
        type: Boolean,
    },
    "grace-ms": {
        description: "Override the SIGTERM→SIGKILL grace period in milliseconds",
        type: Number,
    },
} as const;

const serviceStop = defineCommand({
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
    options: serviceStopOptionDefinitions,
});

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

const serviceStatusOptionDefinitions = {
    timeout: {
        description: "Probe timeout in milliseconds",
        type: Number,
    },
} as const;

const serviceStatus = defineCommand({
    argument: targetIdArgument,
    commandPath: ["service"],
    description: "Re-run the readiness probe and report a service's health",
    examples: [["vis service status @my/api:db", "Check whether the db service is reachable"]],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "serviceStatusExecute"),
    name: "status",
    options: serviceStatusOptionDefinitions,
});

const serviceRestartOptionDefinitions = {
    "grace-ms": {
        description: "Override the SIGTERM→SIGKILL grace period in milliseconds",
        type: Number,
    },
    "no-readiness": {
        defaultValue: false,
        description: "Skip the readiness probe after restart",
        type: Boolean,
    },
    timeout: {
        description: "Readiness probe timeout in milliseconds",
        type: Number,
    },
} as const;

const serviceRestart = defineCommand({
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
    options: serviceRestartOptionDefinitions,
});

const serviceLogsOptionDefinitions = {
    follow: {
        alias: "f",
        defaultValue: false,
        description: "Follow the log file (like `tail -f`)",
        type: Boolean,
    },
} as const;

const serviceLogs = defineCommand({
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
    options: serviceLogsOptionDefinitions,
});

const serviceCommands: AnyCommandInput[] = [serviceStart, serviceStop, serviceList, serviceStatus, serviceRestart, serviceLogs];

export default serviceCommands;

export type ServiceStartOptions = InferOptions<typeof serviceStartOptionDefinitions>;

export type ServiceStopOptions = InferOptions<typeof serviceStopOptionDefinitions>;

export type ServiceListOptions = CreateOptions<{
    format: string | undefined;
}>;

export type ServiceStatusOptions = InferOptions<typeof serviceStatusOptionDefinitions>;

export type ServiceRestartOptions = InferOptions<typeof serviceRestartOptionDefinitions>;

export type ServiceLogsOptions = InferOptions<typeof serviceLogsOptionDefinitions>;
