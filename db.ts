import {PrismaClient} from '@prisma/client';
import * as crypt from 'bcrypt';
import * as uuid from 'uuid';
import {default_user, load} from "./env";
import {importer} from './import';

export const prisma = new PrismaClient()

export type ID = string;

export type User = { id: ID, user: string, pass: string, email: string, verified: boolean }
const limitUser = (u: User): User => ({
    id: u.id, user: u.user, pass: u.pass, email: u.email, verified: u.verified
});

const hash = async (str: string) => {
    const salt = await crypt.genSalt(10);
    return await crypt.hash(str, salt);
}

let everyone: ID;
let admin: ID;

export const everyoneGroup = () => everyone;
export const adminUser = () => admin;

export const init = async () => {
    const groupCount = await prisma.group.count();
    const userCount = await prisma.user.count();

    if(groupCount !== 0 && userCount !== 0) {
        everyone = (await prisma.group.findUniqueOrThrow({ where: { group: "@everyone" } })).id;
        admin = (await prisma.user.findUniqueOrThrow({ where: { user: default_user.name } })).id;
    }
    else {

        everyone = (await prisma.group.create({data: {group: "@everyone"}})).id;

        const group = groupCount === 0 ?
            await prisma.group.create({data: {group: "admin"}}) :
            await prisma.group.findUniqueOrThrow({where: {group: "admin"}});

        const user = userCount === 0 ?
            await prisma.user.create({
                data: {
                    user: default_user.name,
                    email: default_user.email,
                    pass: await hash(default_user.pass),
                    verified: true
                }
            }) :
            await prisma.user.findUniqueOrThrow({where: {user: default_user.name}});

        admin = user.id;

        await prisma.groupUser.create({data: {userId: user.id, groupId: group.id}});
        await prisma.groupUser.create({data: {userId: user.id, groupId: everyone}});
    }

    const dirCount = await prisma.directory.count()
    if(dirCount === 0) {
        await importer(load, admin, everyone);
    }
}

export const newUser = (name: string, pass: string, email: string, accepted: boolean) =>
    hash(pass).then(hPass => prisma.user.create({
        data: {
            user: name,
            pass: hPass,
            email: email,
            verified: accepted
        }
    }));

export const isAdmin = async (user: ID) => {
    const groupsPre = await prisma.user.findUnique({
        where: { id: user },
        include: {
            GroupUser: {
                include: {
                    group: true
                }
            }
        }
    });
    if(groupsPre === null) return false;

    const groups = groupsPre.GroupUser.map(
        ({group}) => group.group
    );
    return groups.includes('admin');
}

export const newGroup = (name: string) =>
    prisma.group.create({ data: { group: name } });

export const joinGroup = (userId: ID, groupId: ID) =>
    prisma.groupUser.create({ data: { userId: userId, groupId: groupId } });

export const leaveGroup = (userId: ID, groupId: ID) =>
    prisma.groupUser.delete({ where: { userId_groupId: { userId: userId, groupId: groupId } } });

export const groupsFor = (userId: ID) =>
    prisma.groupUser.findMany({ where: { userId: userId }, include: { group: true } });

export const checkUser = (name: string, pass: string) =>
    prisma.user.findUniqueOrThrow({ where: { user: name } }).then(user =>
        crypt.compare(pass, user.pass).then(res => {
            if(res === true) return limitUser(user)
            else throw "pass"
        })
    );

export const createSession = (id: ID) =>
    prisma.session.create({ data: { userId: id, cookie: uuid.v4() } })
        .then(session => session.cookie);

export const checkSession = (cookie: string) =>
    prisma.session.findUniqueOrThrow({ where: { cookie: cookie }, include: { user: true } })
        .then(session => limitUser(session.user));

export const endSessions = (user: ID) =>
    prisma.session.deleteMany({ where: { userId: user } })
        .then(_ => {});

export type Perms = {
    groups: {
        [groupId: ID]: {
            rd: boolean,
            wrt: boolean,
            crt: boolean,
            del: boolean
        }
    },

    addNone: (groupId: ID) => Perms;
    addRead: (groupId: ID) => Perms;
    addWrite: (groupId: ID) => Perms;
    addCreate: (groupId: ID) => Perms;
    addDelete: (groupId: ID) => Perms;
    addAll: (groupId: ID) => Perms;
}

type PermUpdate = Partial<{
    [key in 'rd' | 'wrt' | 'crt' | 'del']: boolean;
}>;

const checkOrAdd = (p: Perms, groupId: ID, updates: PermUpdate) => {
    if(p.groups === undefined) {
        p.groups = {}
    }
    if(p.groups[groupId] == undefined) p.groups[groupId] = { rd: false, wrt: false, crt: false, del: false };

    const group = p.groups[groupId];
    if(updates.rd !== undefined) group.rd = updates.rd;
    if(updates.wrt !== undefined) group.wrt = updates.wrt;
    if(updates.crt !== undefined) group.crt = updates.crt;
    if(updates.del !== undefined) group.del = updates.del;

    return p;
}

export const mkPerms = (): Perms => {
    let res = {} as Perms;
    res['groups'] = {};

    res['addNone'] = groupId => checkOrAdd(res, groupId, {});
    res['addRead'] = groupId => checkOrAdd(res, groupId, {rd: true});
    res['addWrite'] = groupId => checkOrAdd(res, groupId, {wrt: true});
    res['addCreate'] = groupId => checkOrAdd(res, groupId, {crt: true});
    res['addDelete'] = groupId => checkOrAdd(res, groupId, {del: true});
    res['addAll'] = groupId => checkOrAdd(res, groupId, {rd: true, wrt: true, crt: true, del: true});

    return res;
};

export const mkdir = async (name: string, parentId: ID|null, ownerId: ID, perms: Perms) => {
    const dir = await prisma.directory.create({
        data: {
            name: name,
            ownerId: ownerId,
            parentId: parentId
        }
    });

    await Promise.all(Object.keys(perms.groups).map(group => {
        const groupId = group;
        const perm = perms.groups[groupId];
        return prisma.permission.create({
            data: {
                dirId: dir.id,
                groupId: groupId,
                allowRead: perm.rd,
                allowWrite: perm.wrt,
                allowCreate: perm.crt,
                allowDelete: perm.del
            }
        });
    }));

    return dir;
}

export const listDirectories = () =>
    prisma.directory.findMany({
        include: {
            File: true,
            DGPermission: true
        }
    });