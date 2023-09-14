import { strict as assert } from "node:assert/strict";
import { test } from "node:test";
// sniff test to see of the dynamic ref bug is still present in ajv
import Ajv2020 from "ajv/dist/2020.js";

const schema = {
	$defs: {
		schema: {
			$dynamicAnchor: "meta",
			type: ["object", "boolean"],
		},
	},

	$schema: "https://json-schema.org/draft/2020-12/schema",
	properties: {
		schema: { $dynamicRef: "#meta" },
	},
	type: "object",

	unevaluatedProperties: false,
};

const data = {
	schema: { type: "string" },
};

test("dynamic ref bug", (t) => {
	const ajv = new Ajv2020();
	const validate = ajv.compile(schema);
	const result = validate(data);
	assert.equal(result, false);
});
