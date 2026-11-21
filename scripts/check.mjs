import fs from 'node:fs';
import vm from 'node:vm';
const files=fs.readdirSync(new URL('../',import.meta.url)).filter(name=>name.endsWith('.gs'));
for(const name of files)new vm.Script(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'),{filename:name});
JSON.parse(fs.readFileSync(new URL('../appsscript.json',import.meta.url),'utf8'));
console.log(files.length+' Apps Script files and manifest parsed.');
