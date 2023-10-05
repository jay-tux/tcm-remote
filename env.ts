require('dotenv').config()

export type LoadCache = {source: string, target: string, recursive: boolean, readable: boolean}[];

const nonEmpty = (input: string, def: string) =>
    input === '' ? def : input;

const trimPath = (input: string) => {
    const temp = input.trim()
    return temp.endsWith('/') ? temp.substring(0, temp.length - 1) : temp;
}

export const storage = trimPath(process.env.STORAGE);
const separator = nonEmpty(process.env.SEPARATOR, ':');
export const load: LoadCache = process.env.LOAD.split(';').map(entry => {
    if (entry == '') return null;

    const tuple = entry.split(separator);
    const booleans = ['true', 'false'];
    if (tuple.length !== 4 || tuple[0] === '' || tuple[1] === '' ||
        !booleans.includes(tuple[2]) || !booleans.includes(tuple[3])) {
        console.log(`Invalid LOAD tuple in .env: ${entry} (tuple: ${tuple}, sep: ${separator})`);
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