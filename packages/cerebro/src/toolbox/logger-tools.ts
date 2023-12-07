import chalk from "chalk";
import { env } from "node:process";
import stripAnsi from "strip-ansi";
import terminalSize from "term-size";

import type { ConfigType, Logger as ILogger } from "../@types";
import { VERBOSITY_DEBUG, VERBOSITY_NORMAL, VERBOSITY_QUIET, VERBOSITY_VERBOSE, VERBOSITY_VERY_VERBOSE } from "../constants";

const icons = {
    critical: "🚫",
    danger: "🚫",
    debug: "◼",
    error: "✖",
    info: "⌽",
    log: "⇢",
    note: "◉",
    notice: "◉",
    status: "◯",
    success: "✔",
    warning: "⚠️",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (arguments_: any, type: "debug" | "error" | "info" | "log" | "warn" = "log"): void => {
    if (process.env["NODE_ENV"] === "test" || Number(process.env["CEREBRO_OUTPUT"]) === VERBOSITY_QUIET) {
        return;
    }

    // eslint-disable-next-line no-console,security/detect-object-injection
    console[type](arguments_);
};

class LoggerTools implements ILogger {
    private static getIcon(type: string): string {
        if (!icons[type as keyof typeof icons]) {
            throw new Error(`Invalid icon type: ${type}`);
        }

        return icons[type as keyof typeof icons] as string;
    }

    private static validateConfig(config: Partial<ConfigType> = {}): ConfigType {
        const finalConfig = { ...config };

        finalConfig.type = finalConfig.type === "" ? "info" : (finalConfig.type as string);

        finalConfig.label = config.label ?? "";

        return finalConfig as ConfigType;
    }

    private static formatMessage(message: object | string): string {
        let result = message;

        if (Array.isArray(message)) {
            return message.join(" ");
        }

        if (typeof message === "object") {
            result = `\r\n${JSON.stringify(message)}\r\n`;
        }

        return result as string;
    }

    private static isPrintable(name: string): boolean {
        switch (name) {
            case "debug": {
                return Number(env["CEREBRO_OUTPUT_LEVEL"]) !== VERBOSITY_QUIET && Number(env["CEREBRO_OUTPUT_LEVEL"]) === VERBOSITY_DEBUG;
            }
            case "danger":
            case "error":
            case "info":
            case "note":
            case "notice":
            case "status":
            case "success":
            case "warning": {
                return (
                    Number(env["CEREBRO_OUTPUT_LEVEL"]) !== VERBOSITY_QUIET &&
                    [VERBOSITY_DEBUG, VERBOSITY_NORMAL, VERBOSITY_VERBOSE, VERBOSITY_VERY_VERBOSE].includes(Number(env["CEREBRO_OUTPUT_LEVEL"]))
                );
            }
            default: {
                return true;
            }
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public isDebug(): boolean {
        return Number(env["CEREBRO_OUTPUT_LEVEL"]) === VERBOSITY_DEBUG;
    }

    // eslint-disable-next-line class-methods-use-this
    public isVerbose(): boolean {
        return Number(env["CEREBRO_OUTPUT_LEVEL"]) === VERBOSITY_VERBOSE;
    }

    // eslint-disable-next-line class-methods-use-this
    public isVeryVerbose(): boolean {
        return Number(env["CEREBRO_OUTPUT_LEVEL"]) === VERBOSITY_VERY_VERBOSE;
    }

    // eslint-disable-next-line class-methods-use-this
    public isQuiet(): boolean {
        return Number(env["CEREBRO_OUTPUT_LEVEL"]) === VERBOSITY_QUIET;
    }

    // eslint-disable-next-line class-methods-use-this
    public clear(): void {
        clear();
    }

    public print(config: Partial<ConfigType> = {}): string {
        const alertConfig = LoggerTools.validateConfig({
            icon: false,
            msg: "",
            type: "info",
            ...config,
        });

        // @ts-expect-error - @TODO: fix this typing
        return this[alertConfig.type](alertConfig.msg, alertConfig.label, alertConfig.icon) as string;
    }

    // eslint-disable-next-line class-methods-use-this
    public critical(message_: object | string, label_ = "", showIcon = false): string {
        if (!LoggerTools.isPrintable("critical")) {
            return "";
        }

        const label = label_ ? ` ${label_} ` : "";
        const icon = showIcon ? `${LoggerTools.getIcon("critical")}  ` : "";
        const output = `${chalk.hex("#FF8800").black(label)}${label ? " " : ""}${icon}${chalk.hex("#FF8800")(LoggerTools.formatMessage(message_))}`;

        log(output, "error");

        return output;
    }

    // eslint-disable-next-line class-methods-use-this
    public error(message_: object | string, label_ = "", showIcon = false): string {
        if (!LoggerTools.isPrintable("error")) {
            return "";
        }

        const label = label_ ? ` ${label_} ` : "";
        const icon = showIcon ? `${LoggerTools.getIcon("error")} ` : "";

        const message = LoggerTools.formatMessage(message_);

        const output = `${chalk.bgRed.black(label)}${label ? " " : ""}${chalk.red(icon + message)}`;

        log(output, "error");

        return output;
    }

    // eslint-disable-next-line class-methods-use-this
    public danger(message_: object | string, label_ = "", showIcon = false): string {
        if (!LoggerTools.isPrintable("danger")) {
            return "";
        }

        const label = label_ ? ` ${label_} ` : "";
        const icon = showIcon ? `${LoggerTools.getIcon("danger")} ` : "";
        const message = LoggerTools.formatMessage(message_);

        const output = `${chalk.bgRed.black(label)}${label ? " " : ""}${chalk.red(icon + message)}`;

        log(output, "error");

        return output;
    }

    // eslint-disable-next-line class-methods-use-this
    public success(message_: object | string, label_ = "", showIcon = false): string {
        if (!LoggerTools.isPrintable("success")) {
            return "";
        }

        const label = label_ ? ` ${label_} ` : "";
        const icon = showIcon ? `${LoggerTools.getIcon("success")} ` : "";
        const message = LoggerTools.formatMessage(message_);

        const output = `${chalk.bgGreen.black(label)}${label ? " " : ""}${chalk.green(icon + message)}`;

        log(output);

        return output;
    }

    // eslint-disable-next-line class-methods-use-this
    public warning(message_: object | string, label_ = "", showIcon = false): string {
        if (!LoggerTools.isPrintable("warning")) {
            return "";
        }

        const label = label_ ? ` ${label_} ` : "";
        const icon = showIcon ? `${LoggerTools.getIcon("warning")} ` : "";
        const message = LoggerTools.formatMessage(message_);

        const output = `${chalk.bgYellow.black(label)}${label ? " " : ""}${chalk.yellow(icon + message)}`;

        log(output, "warn");

        return output;
    }

    // eslint-disable-next-line class-methods-use-this
    public info(message_: object | string, label_ = "", showIcon = false): string {
        if (!LoggerTools.isPrintable("info")) {
            return "";
        }

        const label = label_ ? ` ${label_} ` : "";
        const icon = showIcon ? `${LoggerTools.getIcon("info")} ` : "";
        const message = LoggerTools.formatMessage(message_);

        const output = `${chalk.bgCyan.black(label)}${label ? " " : ""}${chalk.cyan(icon + message)}`;

        log(output, "info");

        return output;
    }

    // eslint-disable-next-line class-methods-use-this
    public debug(message_: object | string, label_ = "", showIcon = false): string {
        if (!LoggerTools.isPrintable("debug")) {
            return "";
        }

        const label = label_ ? ` ${label_} ` : "";
        const icon = showIcon ? `${LoggerTools.getIcon("debug")} ` : "";
        const message = LoggerTools.formatMessage(message_);

        const output = `${chalk.bgGray.black(label)}${label ? " " : ""}${chalk.gray(icon + message)}`;

        log(output, "debug");

        return output;
    }

    // eslint-disable-next-line class-methods-use-this
    public log(message_: object | string, label_ = "", showIcon = false): string {
        const label = label_ ? ` ${label_} ` : "";
        const icon = showIcon ? `${LoggerTools.getIcon("log")} ` : "";
        const message = LoggerTools.formatMessage(message_);

        const output = `${chalk.bgWhite.black(label)}${label ? " " : ""}${icon + message}`;

        log(output);

        return output;
    }

    // eslint-disable-next-line class-methods-use-this
    public status(message_: object | string, label_ = "", showIcon = false): string {
        if (!LoggerTools.isPrintable("status")) {
            return "";
        }

        const label = label_ ? ` ${label_} ` : "";
        const icon = showIcon ? `${LoggerTools.getIcon("status")} ` : "";
        const message = LoggerTools.formatMessage(message_);

        const output = `${chalk.bgMagenta.black(label)}${label ? " " : ""}${chalk.magenta(icon + message)}`;

        log(output);

        return output;
    }

    // eslint-disable-next-line class-methods-use-this
    public notice(message_: object | string, label_ = "", showIcon = false): string {
        if (!LoggerTools.isPrintable("notice")) {
            return "";
        }

        const label = label_ ? ` ${label_} ` : "";
        const icon = showIcon ? `${LoggerTools.getIcon("notice")} ` : "";
        const message = LoggerTools.formatMessage(message_);
        const output = `${chalk.bgBlue.black(label)}${label ? " " : ""}${chalk.blue(icon + message)}`;

        log(output, "info");

        return output;
    }

    // eslint-disable-next-line class-methods-use-this
    public note(message_: object | string, label_ = "", showIcon = false): string {
        if (!LoggerTools.isPrintable("note")) {
            return "";
        }

        const label = label_ ? ` ${label_} ` : "";
        const icon = showIcon ? `${LoggerTools.getIcon("note")} ` : "";
        const message = LoggerTools.formatMessage(message_);
        const output = `${chalk.bgHex("#FF8800").black(label)}${label ? " " : ""}${chalk.hex("#FF8800")(icon + message)}`;

        log(output, "info");

        return output;
    }

    // eslint-disable-next-line class-methods-use-this
    public line(message = ""): string {
        const { columns } = terminalSize();

        const output = message.repeat(columns - 2);

        log(output);

        return output;
    }

    // eslint-disable-next-line class-methods-use-this
    public center(message: string, fillText = " "): string {
        // if the terminal width is shorter than message length, dont display fillText
        const { columns } = terminalSize();

        if (stripAnsi(message).length >= columns) {
            log(message);

            return message;
        }

        const left = Number.parseInt(String((columns - stripAnsi(message).length) / 2), 10);
        const padString = fillText.repeat(left / stripAnsi(fillText).length);
        const output = padString + message + padString;

        log(output);

        return output;
    }
}

const logger = new LoggerTools();

export default logger;
