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
        displayName: "event-loop",
        health: {
            healthy: true,
            timestamp: dateString,
        },
    };
};

describe("healthCheck", () => {
    it("get health checks report", async () => {
        expect.assertions(1);

        const healthCheck = new HealthCheck();

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
        expect.assertions(1);

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
        expect.assertions(1);

        const healthCheck = new HealthCheck();

        healthCheck.addChecker("database", getDatabaseChecker);

        healthCheck.addChecker("event-loop", async () => {
            throw new Error("boom");
        });

        const report = await healthCheck.getReport();

        expect(report).toStrictEqual({
            healthy: false,
            report: {
                database: {
                    displayName: "database",
                    health: {
                        healthy: true,
                        timestamp: dateString,
                    },
                },
                "event-loop": {
                    displayName: "event-loop",
                    health: {
                        healthy: false,
                        message: "boom",
                        timestamp: report.report["event-loop"].health.timestamp,
                    },
                    meta: {
                        fatal: true,
                    },
                },
            },
        });
    });

    it("should show a list of all services", async () => {
        expect.assertions(1);

        const healthCheck = new HealthCheck();

        healthCheck.addChecker("database", getDatabaseChecker);

        healthCheck.addChecker("event-loop", getEventChecker);

        expect(healthCheck.servicesList).toStrictEqual(["database", "event-loop"]);
    });

    it("should return a boolean if the service is live", async () => {
        expect.assertions(2);

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

        await expect(healthCheck.isLive()).resolves.toBe(false);

        const healthCheck2 = new HealthCheck();

        healthCheck2.addChecker("database", getDatabaseChecker);

        healthCheck2.addChecker("event-loop", getEventChecker);

        await expect(healthCheck2.isLive()).resolves.toBe(true);
    });
});
