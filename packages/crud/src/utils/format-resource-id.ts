const formatResourceId = (resourceId: string): number | string => (Number.isSafeInteger(+resourceId) ? +resourceId : resourceId);

export default formatResourceId;
