import type { ISpectralDiagnostic } from "@stoplight/spectral-core";
import { Spectral as OASValidator } from "@stoplight/spectral-core";
import type { IDocument, IParsedResult } from "@stoplight/spectral-core/dist/document";
import { asyncapi, oas } from "@stoplight/spectral-rulesets";

const validator = new OASValidator();

validator.setRuleset({
    // @ts-expect-error: TS2322
    extends: [oas, asyncapi],
});

const validate = async (spec: IDocument | IParsedResult | Record<string, unknown> | string): Promise<ISpectralDiagnostic[]> => {
    let title = "";

    if (typeof spec === "object") {
        title = (spec as { info: { title: string } }).info.title;
    } else if (typeof spec === "string") {
        title = spec;
    }

    return validator
        .run(spec)
        .then((results) => {
            results.forEach((result) => {
                // Ensure there are no errors about no format being matched
                if (result.code === "unrecognized-format") {
                    throw new Error(`Could not validate OpenAPI Specification '${title}'. ${result.message}`);
                }

                if (result.severity < 1) {
                    throw new Error(`Invalid OpenAPI Specification '${title}'. [${result.path.join(".")}] ${result.message}`);
                }
            });

            return results;
        })
        .catch((error) => {
            throw new Error(`Could not validate OpenAPI Specification '${title}'. ${error.message}`);
        });
};

export default validate;
