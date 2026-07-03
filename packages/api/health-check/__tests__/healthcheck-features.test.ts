import { describe, expect, it, vi } from "vitest";

import { HealthCheck } from "../src";

const dateString = new Date().toISOString();

const healthyChecker = async () => {
    return {
        displayName: "ok",
        health: {
            healthy: true,
            timestamp: dateString,
        },
    };
};

describe("healthCheck features", () => {
    describe("removeChecker", () => {
        it("removes a registered checker and returns true", async () => {
            expect.assertions(3);

            const healthCheck = new HealthCheck();

            healthCheck.addChecker("db", healthyChecker);

            expect(healthCheck.servicesList).toStrictEqual(["db"]);
            expect(healthCheck.removeChecker("db")).toBe(true);
            expect(healthCheck.servicesList).toStrictEqual([]);
        });

        it("returns false when the checker does not exist", () => {
            expect.assertions(1);

            const healthCheck = new HealthCheck();

            expect(healthCheck.removeChecker("missing")).toBe(false);
        });
    });

    describe("per-check timeout", () => {
        it("reports unhealthy when a checker exceeds its timeout", async () => {
            expect.assertions(2);

            const healthCheck = new HealthCheck();

            healthCheck.addChecker(
                "slow",
                async () =>
                    new Promise((resolve) => {
                        setTimeout(resolve, 200, { displayName: "slow", health: { healthy: true, timestamp: dateString } });
                    }),
                { timeout: 20 },
            );

            const { healthy, report } = await healthCheck.getReport();

            expect(healthy).toBe(false);
            expect(report.slow.health.message).toContain("timed out after 20ms");
        });

        it("reports unhealthy when a checker never resolves", async () => {
            expect.assertions(3);

            const healthCheck = new HealthCheck();

            healthCheck.addChecker(
                "hung",
                // A checker that never settles — without a timeout this would
                // hang the whole report forever.
                async () => new Promise<never>(() => {}),
                { timeout: 20 },
            );

            const { healthy, report } = await healthCheck.getReport();

            expect(healthy).toBe(false);
            expect(report.hung.health.healthy).toBe(false);
            expect(report.hung.health.message).toContain("timed out after 20ms");
        });

        it("applies the defaultTimeout to checkers without their own", async () => {
            expect.assertions(1);

            const healthCheck = new HealthCheck({ defaultTimeout: 20 });

            healthCheck.addChecker(
                "slow",
                async () =>
                    new Promise((resolve) => {
                        setTimeout(resolve, 200, { displayName: "slow", health: { healthy: true, timestamp: dateString } });
                    }),
            );

            const { healthy } = await healthCheck.getReport();

            expect(healthy).toBe(false);
        });
    });

    describe("report caching", () => {
        it("does not re-run checkers within the cache window", async () => {
            expect.assertions(2);

            const healthCheck = new HealthCheck({ cacheTtl: 10_000 });
            const spy = vi.fn<typeof healthyChecker>(healthyChecker);

            healthCheck.addChecker("db", spy);

            await healthCheck.getReport();
            await healthCheck.getReport();

            expect(spy).toHaveBeenCalledTimes(1);

            // Mutating the registry invalidates the cache.
            healthCheck.addChecker("db2", spy);
            await healthCheck.getReport();

            expect(spy).toHaveBeenCalledTimes(3);
        });

        it("re-runs checkers when caching is disabled", async () => {
            expect.assertions(1);

            const healthCheck = new HealthCheck();
            const spy = vi.fn<typeof healthyChecker>(healthyChecker);

            healthCheck.addChecker("db", spy);

            await healthCheck.getReport();
            await healthCheck.getReport();

            expect(spy).toHaveBeenCalledTimes(2);
        });
    });

    describe("liveness vs readiness", () => {
        it("isLive only runs liveness-tagged checkers", async () => {
            expect.assertions(2);

            const healthCheck = new HealthCheck();

            healthCheck.addChecker("live", healthyChecker, { type: "liveness" });
            healthCheck.addChecker(
                "ready",
                async () => {
                    return { displayName: "ready", health: { healthy: false, message: "down", timestamp: dateString } };
                },
                { type: "readiness" },
            );

            await expect(healthCheck.isLive()).resolves.toBe(true);
            await expect(healthCheck.isReady()).resolves.toBe(false);
        });

        it("checkers participate in both probes by default", async () => {
            expect.assertions(2);

            const healthCheck = new HealthCheck();

            healthCheck.addChecker("db", healthyChecker);

            await expect(healthCheck.isLive()).resolves.toBe(true);
            await expect(healthCheck.isReady()).resolves.toBe(true);
        });

        it("getReport filters by type", async () => {
            expect.assertions(2);

            const healthCheck = new HealthCheck();

            healthCheck.addChecker("live", healthyChecker, { type: "liveness" });
            healthCheck.addChecker("ready", healthyChecker, { type: "readiness" });

            const liveReport = await healthCheck.getReport("liveness");

            expect(Object.keys(liveReport.report)).toStrictEqual(["live"]);

            const readyReport = await healthCheck.getReport("readiness");

            expect(Object.keys(readyReport.report)).toStrictEqual(["ready"]);
        });
    });

    describe("graceful shutdown", () => {
        it("runs shutdown hooks in registration order", async () => {
            expect.assertions(1);

            const healthCheck = new HealthCheck();
            const order: number[] = [];

            healthCheck.onShutdown(() => {
                order.push(1);
            });
            healthCheck.onShutdown(async () => {
                order.push(2);
            });

            await healthCheck.shutdown();

            expect(order).toStrictEqual([1, 2]);
        });
    });
});
