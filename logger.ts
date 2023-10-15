import morgan from "morgan";
import {Express} from "express";
import {errorHeader} from './config.json';

enum color {
    black = 0,
    red = 1,
    green = 2,
    yellow = 3,
    blue = 4,
    magenta = 5,
    cyan = 6,
    white = 7,
    gray = 60
}
const fgMod = 30;
const bgMod = 40;

enum effect {
    bold = 1,
    underline = 4,
    blink = 5,
    reverse = 7,
    hidden = 8
}

type options = {
    fore: color|null;
    back: color|null;
    effects: effect[];
}

const colorForStatus = [ color.black, color.blue, color.green, color.cyan, color.red, color.magenta ];

const mkAnsi = (what: options|null) => {
    if(what === null) return "\x1b[0m";
    if(what.fore === null && what.back === null && what.effects.length === 0) return "";

    let str = "\x1b[";
    if(what.fore !== null) str += `${fgMod + what.fore.valueOf()};`;
    if(what.back !== null) str += `${bgMod + what.back.valueOf()};`;

    what.effects.forEach((e) => str += `${e.valueOf()};`);

    return `${str.substring(0, str.length - 1)}m`
}

const ansiStatus = (status: number) => mkAnsi({
   fore: colorForStatus[Math.floor(status / 100)],
   back: null,
   effects: []
});

const reset = mkAnsi(null);

export const install = (app: Express) => {
    app.use(morgan((tok, req, res) => {
        const status = tok["status"](req, res);
        let final = `${ansiStatus(+status)}${status}${reset} ${tok["method"](req, res)} ${tok["url"](req, res)}`;
        if(req.headers.authorization != undefined) final += ` as ${req.headers.authorization}`;
        final += ` in ${tok["response-time"](req, res)} ms`;

        if(status[0] === '4') final += ` (reason: ${res.getHeader(errorHeader)})`;

        return final;
    }));
}