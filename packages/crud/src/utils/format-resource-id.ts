const formatResourceId = (resourceId: string): string | number => (Number.isSafeInteger(+resourceId) ? +resourceId : resourceId);

export default formatResourceId;
