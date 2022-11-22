import { describe, expect, it } from "vitest";

import { HealthCheck } from "../src";

const dateString = new Date().toISOString();

const getDatabaseChecker = async () => {
    return {
        displayName: "database",
        health: {
            healthy: true,
            timestamp: dateString,
        },
    };
};

const getEventChecker = async () => {
    return {
        // eslint-disable-next-line radar/no-duplicate-string
        displayName: "event-loop",
        health: {
            healthy: true,
            timestamp: dateString,
        },
    };
};

describe("HealthCheck", () => {
    it("get health checks report", async () => {
        const healthCheck = new HealthCheck();

        // eslint-disable-next-line radar/no-duplicate-string
        healthCheck.addChecker("event-loop", async () => {
            return {
                displayName: "event loop",
                health: {
                    healthy: true,
                    message: "event loop is healthy",
                    timestamp: dateString,
                },
            };
        });

        const report = await healthCheck.getReport();

        expect(report).toStrictEqual({
            healthy: true,
            report: {
                "event-loop": {
                    displayName: "event loop",
                    health: {
                        healthy: true,
                        message: "event loop is healthy",
                        timestamp: dateString,
                    },
                },
            },
        });
    });

    it("handle exceptions raised within the checker", async () => {
        const healthCheck = new HealthCheck();

        healthCheck.addChecker("event-loop", async () => {
            throw new Error("boom");
        });

        const report = await healthCheck.getReport();

        expect(report).toStrictEqual({
            healthy: false,
            report: {
                "event-loop": {
                    displayName: "event-loop",
                    health: {
                        healthy: false,
                        message: "boom",
                        // @ts-ignore
                        timestamp: report.report["event-loop"].health.timestamp,
                    },
                    meta: {
                        fatal: true,
                    },
                },
            },
        });
    });

    it("set healthy to false when any of the checker fails", async () => {
        const healthCheck = new HealthCheck();

        healthCheck.addChecker("database", getDatabaseChecker);

        healthCheck.addChecker("event-loop", async () => {
            throw new Error("boom");
        });

        const report = await healthCheck.getReport();

        expect(report).toStrictEqual({
            healthy: false,
            report: {
                "event-loop": {
                    displayName: "event-loop",
                    health: {
                        healthy: false,
                        message: "boom",
                        // @ts-ignore
                        timestamp: report.report["event-loop"].health.timestamp,
                    },
                    meta: {
                        fatal: true,
                    },
                },
                database: {
                    displayName: "database",
                    health: {
                        healthy: true,
                        timestamp: dateString,
                    },
                },
            },
        });
    });

    it("should show a list of all services", async () => {
        const healthCheck = new HealthCheck();

        healthCheck.addChecker("database", getDatabaseChecker);

        healthCheck.addChecker("event-loop", getEventChecker);

        expect(healthCheck.servicesList).toStrictEqual(["database", "event-loop"]);
    });

    it("should return a boolean if the service is live", async () => {
        const healthCheck = new HealthCheck();

        healthCheck.addChecker("database", async () => {
            return {
                displayName: "database",
                health: {
                    healthy: false,
                    message: "error",
                    timestamp: dateString,
                },
            };
        });

        expect(await healthCheck.isLive()).toBe(false);

        const healthCheck2 = new HealthCheck();

        healthCheck2.addChecker("database", getDatabaseChecker);

        healthCheck2.addChecker("event-loop", getEventChecker);

        expect(await healthCheck2.isLive()).toBe(true);
    });
});
