import Nodehun  from 'nodehun'
import fs from 'fs';

const affix       = fs.readFileSync('dictionaries/en_NZ.aff')
const dictionary  = fs.readFileSync('dictionaries/en_NZ.dic')
// @ts-ignore
const nodehun     = new Nodehun(affix, dictionary)

export const suggest = (word: string) => hun_suggest(word);

async function hun_suggest(word: string) {
  let suggestions = await nodehun.suggest(word);
  console.log(suggestions);
}
