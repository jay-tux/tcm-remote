import {Request, Response, Router} from "express";
import {checkSession, listDirectories, User} from "../db";
import {deleteUser, listGroups, listUsers, login, logout, register, self, verifyUser} from "./user";
import {list} from "./list";
import {getFile} from "./file";

const checkHeaders = async (req: Request, res: Response) => {
    res.contentType('application/json');

    if(req.headers.accept !== undefined && req.headers.accept !== 'application/json') {
        console.log(`Got unexpected accept-header: '${req.headers.accept}'`)
        throw {status: 406, reason: 'API endpoints only provide JSON.'};
    }
    if(Object.keys(req.body).length !== 0 && !req.headers["content-type"].startsWith('application/json')) {
        console.log(`Got unexpected content-type-header: '${req.headers["content-type"]}'`);
        throw {status: 400, reason: 'API endpoints only support JSON.'};
    }
}

const promiseToEp = <T>(req: Request, res: Response, prom: Promise<T>) => {
    prom.then(r => { res.status(200).send(r === undefined ? {} : r) })
        .catch(err => res.status(err.status).send(err));
}

export const checkAuth = async (req: Request, allowUnverified: boolean = false) => {
    if(!req.headers.authorization) throw { status: 403, reason: "No authorization provided." };

    try {
        const session = await checkSession(req.headers.authorization);
        if(!allowUnverified && !session.verified)
            throw { status: 403, reason: "Your account is still awaiting verification." };
        return session;
    }
    catch(err) {
        if(err.status == undefined && err.reason == undefined)
            throw { status: 403, reason: "Invalid authorization token." };
    }
}

const endpoint = <T>(callback: (req: Request) => Promise<T>) => {
    return async (req: Request, res: Response) => {
        promiseToEp(req, res, checkHeaders(req, res).then(() => callback(req)));
    }
}

const modEndpoint = <T>(callback: (req: Request, res: Response, session: User) => Promise<T>) => {
    return async (req: Request, res: Response) => {
        await checkHeaders(req, res);
        await checkAuth(req);
        promiseToEp(req, res, checkHeaders(req, res)
            .then(() => checkAuth(req))
            .then(auth => callback(req, res, auth))
        );
    }
}

const authEndpoint = <T>(callback: (req: Request, session: User) => Promise<T>, allowUnverified: boolean = false) =>
    endpoint((req: Request) => checkAuth(req, allowUnverified).then(user => callback(req, user)));

export const apiRouter = () => {
    const router = Router();

    router.post('/login', endpoint(login));
    router.post('/register', endpoint(register));
    router.post('/logout', authEndpoint(logout));
    router.get('/token', authEndpoint(async (r, u) => ({}), true));
    router.get('/self', authEndpoint(self, true));

    router.get('/users', authEndpoint(listUsers));
    router.delete('/user', authEndpoint(deleteUser))
    router.post('/verify', authEndpoint(verifyUser));
    router.get('/groups', authEndpoint(listGroups));

    router.get('/list', authEndpoint(list));
    router.get('/file/:id', modEndpoint(getFile));

    return router;
}