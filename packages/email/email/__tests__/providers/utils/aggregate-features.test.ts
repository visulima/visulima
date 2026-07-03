import { describe, expect, it } from "vitest";

import type { Provider } from "../../../src/providers/provider";
import aggregateProviderFeatures from "../../../src/providers/utils/aggregate-features";
import type { FeatureFlags } from "../../../src/types";

const mailer = (features: FeatureFlags): Provider => {
    return {
        features,
        initialize: () => {
            // no-op
        },
        isAvailable: () => true,
        name: "mock",
        sendEmail: () => {
            return { success: true };
        },
    };
};

describe(aggregateProviderFeatures, () => {
    it("returns an empty map when there are no resolvable children", () => {
        expect.assertions(1);

        expect(aggregateProviderFeatures([])).toStrictEqual({});
    });

    it("mirrors a single child's declared flags", () => {
        expect.assertions(1);

        expect(aggregateProviderFeatures([mailer({ attachments: true, html: true, replyTo: true })])).toStrictEqual({
            attachments: true,
            html: true,
            replyTo: true,
        });
    });

    it("advertises a capability only when every child supports it", () => {
        expect.assertions(1);

        const result = aggregateProviderFeatures([mailer({ attachments: true, replyTo: true }), mailer({ attachments: true, replyTo: false })]);

        // attachments: true everywhere -> true; replyTo: mixed -> omitted (unknown)
        expect(result).toStrictEqual({ attachments: true });
    });

    it("marks a capability unsupported only when every child rejects it", () => {
        expect.assertions(1);

        expect(aggregateProviderFeatures([mailer({ tagging: false }), mailer({ tagging: false })])).toStrictEqual({ tagging: false });
    });

    it("treats an undefined flag on any child as unknown", () => {
        expect.assertions(1);

        // one child says true, the other omits it -> cannot guarantee -> omitted
        expect(aggregateProviderFeatures([mailer({ scheduling: true }), mailer({})])).toStrictEqual({});
    });

    it("skips factories that cannot be constructed without config", () => {
        expect.assertions(1);

        const throwingFactory = (): Provider => {
            throw new Error("apiKey required");
        };

        expect(aggregateProviderFeatures([throwingFactory, mailer({ html: true })])).toStrictEqual({ html: true });
    });
});
