import SwaggerParser from "@apidevtools/swagger-parser";
// eslint-disable-next-line import/no-named-as-default
import type OpenAPI from "openapi-types";

const validate = async (spec: Record<string, unknown>): Promise<void> => {
    await SwaggerParser.validate(spec as OpenAPI.OpenAPI.Document);
};

export default validate;
