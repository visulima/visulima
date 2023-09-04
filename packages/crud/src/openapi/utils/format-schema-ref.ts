// eslint-disable-next-line unicorn/prevent-abbreviations
const formatSchemaReference = (schemaName: string): string => `#/components/schemas/${schemaName}`;

export default formatSchemaReference;
