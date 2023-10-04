import express, {NextFunction, Request, Response} from 'express';
import * as config from './config.json';
import {init} from "./db";
import {urlencoded, json} from "express";
import {apiRouter} from "./api/endpoints";

const app = express();

app.use(urlencoded({ extended: true }));
app.use(json({}));

app.use(express.static('static'));
app.use((req: Request, _: Response, next: NextFunction) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();

});
app.use('/api', apiRouter());

app.listen(config.port, () => init().then(() => console.log(`Server ready (port ${config.port}).`)));
