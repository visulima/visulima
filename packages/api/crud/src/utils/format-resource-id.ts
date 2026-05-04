// eslint-disable-next-line @stylistic/no-extra-parens -- parens needed to disambiguate arrow body from ternary expression (no-confusing-arrow)
const formatResourceId = (resourceId: string): number | string => (Number.isSafeInteger(+resourceId) ? +resourceId : resourceId);

export default formatResourceId;
