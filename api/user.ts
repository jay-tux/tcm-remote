import {Request} from "express";
import {
    adminUser,
    checkUser,
    createSession,
    endSessions, everyoneGroup,
    isAdmin,
    joinGroup,
    mkdir,
    mkPerms,
    newGroup,
    newUser,
    prisma,
    User
} from "../db";
import * as config from '../config.json';

export const login = async (req: Request) => {
    const name = req.body['name'];
    const pass = req.body['pass'];

    if (name == undefined || pass == undefined)
        throw {status: 400, reason: "Missing name or pass."};

    try {
        const user = await checkUser(name, pass);
        const session = await createSession(user.id);
        return ({success: true, session: session});
    } catch (err) {
        console.log(err);
        throw {status: 409, reason: "Invalid username or password."};
    }
}

export const register = async (req: Request) => {
    const name = req.body['name'];
    const pass = req.body['pass'];
    const mail = req.body['email'];

    if(name == undefined || pass == undefined || mail == undefined)
        throw { status: 400, reason: "Missing name, pass or email fields." };

    try {
        const user = await newUser(name, pass, mail, !config.requireAccept);
        const group = await newGroup(name);
        await joinGroup(user.id, group.id);
        await joinGroup(user.id, everyoneGroup());
        if(config.autoCreateDirectory) {
            await mkdir(name, null, user.id, mkPerms().addAll(group.id));
        }
        return { success: true, session: await createSession(user.id) };
    }
    catch(err) {
        console.log(err)
        throw { status: 400, reason: "Couldn't create user (e-mail or username might already be in use)." }
    }
}

export const self = async (req: Request, user: User) => {
    const groups = await prisma.groupUser.findMany({
        where: { userId: user.id },
        include: { group: true }
    })

    return {
        id: user.id,
        name: user.user,
        email: user.email,
        verified: user.verified,
        isAdmin: groups.some(group => group.group.group === 'admin'),
        groups: groups.map(group => ({
            id: group.group.id,
            name: group.group.group
        }))
    }
};

export const logout = async (req: Request, user: User) =>
    endSessions(user.id);

export const listUsers = async (req: Request, user: User) => {
    if(!(await isAdmin(user.id))) throw { status: 403, reason: "You don't have permission to list all users." };

    try {
        const users = await prisma.user.findMany();
        return await Promise.all(users.map(async u => ({
            id: u.id,
            name: u.user,
            email: u.email,
            verified: u.verified,
            isAdmin: await isAdmin(u.id)
        })));
    }
    catch(err) {
        throw { status: 500, reason: "Something went wrong while listing all users." };
    }
}

export const listGroups = async (req: Request, user: User) => {
    if(!(await isAdmin(user.id))) throw { status: 403, reason: "You don't have permission to list all users." };

    try {
        const groups = await prisma.group.findMany();
        return await Promise.all(groups.map(async g => {
            const members = await prisma.groupUser.findMany({
                where: { groupId: g.id },
                include: { user: {} }
            });

            return ({
                id: g.id,
                name: g.group,
                members: members.map(m => ({ id: m.userId, name: m.user.user }))
            });
        }));
    }
    catch(err) {
        throw { status: 500, reason: "Something went wrong while listing all users." };
    }
}

export const verifyUser = async (req: Request, user: User) => {
    if(!(await isAdmin(user.id))) throw { status: 403, reason: "You don't have permission to verify users." };

    const id = req.body['user'];

    if (id == null) {
        throw {status: 404, reason: "Missing user key in request."};
    }

    try {
        await prisma.user.update({
            where: {
                id: `${id}`
            },
            data: {
                verified: true
            }
        });
    } catch (err) {
        throw {status: 404, reason: "User doesn't exist."};
    }
}

export const deleteUser = async (req: Request, user: User) => {
    if(!(await isAdmin(user.id))) throw { status: 403, reason: "You don't have permission to verify users." };

    // TODO: fix broken owners
    const id = req.body['user'];

    if (id == null)
        throw {status: 404, reason: "Missing user or user is not a valid ID."};

    try {
        await prisma.directory.updateMany({
            where: {
                ownerId: `${id}`
            },
            data: {
                ownerId: adminUser()
            }
        })

        await prisma.user.delete({
            where: {
                id: `${id}`
            }
        });
    } catch (err) {
        console.log(err);
        throw {status: 404, reason: "User doesn't exist or database constraints are preventing their removal."};
    }
}