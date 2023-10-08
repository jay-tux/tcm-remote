import express, {NextFunction, Request, Response} from 'express';
import * as config from './config.json';
import {init} from "./db";
import {urlencoded, json} from "express";
import {apiRouter} from "./api/endpoints";
import {networkInterfaces} from 'os';

const getIps = () => {
    const nets = networkInterfaces();
    const ip: string[] = [];

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
            const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
            if (net.family === familyV4Value && !net.internal) {
                ip.push(net.address);
            }
        }
    }
    return ip;
}


const app = express();

app.use(urlencoded({ extended: true }));
app.use(json({}));

app.use(express.static('static'));
app.use((req: Request, _: Response, next: NextFunction) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();

});
app.use('/api', apiRouter());

app.listen(config.port, () => init().then(() => {
    console.log(`Server ready; listening on: `);
    getIps().forEach(ip => {
        console.log(`\t${ip}:${config.port}`);
    });
}));
