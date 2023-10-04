require('dotenv').config()

export type LoadCache = {source: string, target: string, recursive: boolean, readable: boolean}[];

const nonEmpty = (input: string, def: string) =>
    input === '' ? def : input;

export const storage = process.env.STORAGE;
export const load: LoadCache = process.env.LOAD.split(';').map(entry => {
   const tuple = entry.split(':');
   const booleans = ['true', 'false'];
   if(tuple.length !== 4 || tuple[0] === '' || tuple[1] === '' ||
       !booleans.includes(tuple[3]) || !booleans.includes(tuple[4])) {
       console.log(`Invalid LOAD tuple in .env: ${entry}`);
       return null;
   }
   return {
       source: tuple[1],
       target: tuple[0],
       recursive: tuple[2] === 'true',
       readable: tuple[3] === 'true'
   };
}).filter(pair => pair !== null);

export const default_user = {
    name: nonEmpty(process.env.DEFAULT_USER, 'admin'),
    email: nonEmpty(process.env.DEFAULT_EMAIL, 'admin@test.com'),
    pass: nonEmpty(process.env.DEFAULT_PASS, 'admin')
};