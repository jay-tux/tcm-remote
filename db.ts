import {PrismaClient} from '@prisma/client';
import * as crypt from 'bcrypt';
import * as uuid from 'uuid';
import {default_user, load} from "./env";
import {importer} from './import';

export const prisma = new PrismaClient()

export type User = { id: number, user: string, pass: string, email: string, verified: boolean }
const limitUser = (u: User): User => ({
    id: u.id, user: u.user, pass: u.pass, email: u.email, verified: u.verified
});

const hash = async (str: string) => {
    const salt = await crypt.genSalt(10);
    return await crypt.hash(str, salt);
}

let everyone: number;

export const init = async () => {
    const groupCount = await prisma.group.count();
    const userCount = await prisma.user.count();

    if(groupCount !== 0 && userCount !== 0) {
        everyone = (await prisma.group.findUniqueOrThrow({ where: { group: "@everyone" } })).id;
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

        await prisma.groupUser.create({data: {userId: user.id, groupId: group.id}});
        await prisma.groupUser.create({data: {userId: user.id, groupId: everyone}});
    }

    const dirCount = await prisma.directory.count()
    if(dirCount === 0) {
        await importer(load);
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

export const isAdmin = async (user: number) => {
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

export const joinGroup = (userId: number, groupId: number) =>
    prisma.groupUser.create({ data: { userId: userId, groupId: groupId } });

export const leaveGroup = (userId: number, groupId: number) =>
    prisma.groupUser.delete({ where: { userId_groupId: { userId: userId, groupId: groupId } } });

export const groupsFor = (userId: number) =>
    prisma.groupUser.findMany({ where: { userId: userId }, include: { group: true } });

export const checkUser = (name: string, pass: string) =>
    prisma.user.findUniqueOrThrow({ where: { user: name } }).then(user =>
        crypt.compare(pass, user.pass).then(res => {
            if(res === true) return limitUser(user)
            else throw "pass"
        })
    );

export const createSession = (id: number) =>
    prisma.session.create({ data: { userId: id, cookie: uuid.v4() } })
        .then(session => session.cookie);

export const checkSession = (cookie: string) =>
    prisma.session.findUniqueOrThrow({ where: { cookie: cookie }, include: { user: true } })
        .then(session => limitUser(session.user));

export const endSessions = (user: number) =>
    prisma.session.deleteMany({ where: { userId: user } })
        .then(_ => {});

export type Perms = {
    groups: {
        [groupId: number]: {
            rd: boolean,
            wrt: boolean,
            crt: boolean,
            del: boolean
        }
    },

    addRead: (groupId: number) => Perms;
    addWrite: (groupId: number) => Perms;
    addCreate: (groupId: number) => Perms;
    addDelete: (groupId: number) => Perms;
    addAll: (groupId: number) => Perms;
}

type PermUpdate = Partial<{
    [key in 'rd' | 'wrt' | 'crt' | 'del']: boolean;
}>;

const checkOrAdd = (p: Perms, groupId: number, updates: PermUpdate) => {
    if(p.groups === undefined) {
        console.log('p.groups === undefined???')
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

export const mkPerms = () => ({
    groups: {},
    addRead: groupId => checkOrAdd(this, groupId, { rd: true }),
    addWrite: groupId => checkOrAdd(this, groupId, { wrt: true }),
    addCreate: groupId => checkOrAdd(this, groupId, { crt: true }),
    addDelete: groupId => checkOrAdd(this, groupId, { del: true }),
    addAll: groupId => checkOrAdd(this, groupId, { rd: true, wrt: true, crt: true, del: true })
}) as Perms;

export const mkdir = async (name: string, parentId: number|null, ownerId: number, perms: Perms) => {
    const dir = await prisma.directory.create({
        data: {
            name: name,
            ownerId: ownerId,
            parentId: parentId
        }
    });

    await Promise.all(Object.keys(perms.groups).map(group => {
        const groupId = +group;
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