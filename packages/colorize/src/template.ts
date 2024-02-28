import chalk, { chalkStderr } from "";

export const makeTaggedTemplate = (chalkInstance) => makeChalkTemplate(makeTemplate(chalkInstance));

export const template = makeTemplate(chalk);
export default makeChalkTemplate(template);
