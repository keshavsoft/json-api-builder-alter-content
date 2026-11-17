import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const main = pkg.main;

await import(pathToFileURL(resolve(main)).href);
console.log('Check passed:', main);
