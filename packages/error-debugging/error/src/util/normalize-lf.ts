const normalizeLF = (code: string): string => code.replaceAll(/\r\n|\r(?!\n)|\n/gu, "\n");

export default normalizeLF;
