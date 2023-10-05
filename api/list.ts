import {Request} from "express";
import {groupsFor, ID, isAdmin, listDirectories, Perms, prisma, User} from "../db";
import {Directory, File} from "@prisma/client";
import {seqMap} from "../util";

const flatten = <T>(vs: T[][]) => {
    const res: T[] = [];
    vs.forEach(sub => sub.forEach(val => res.push(val)));
    return res;
}

const dirFullName = async (d: Directory) => {
    if(d.parentId == null) return d.name;

    const parent = await prisma.directory.findUnique({ where: { id: d.parentId } });
    return `${await dirFullName(parent)}/${d.name}`;
}

const fullName = async (f: File) => {
    const parent = await prisma.directory.findUnique({ where: { id: f.parentId } });
    return `${await dirFullName(parent)}/${f.name}`;
}

export const list = async (req: Request, user: User) => {
    try {
        const groups = await groupsFor(user.id);
        const directories = await listDirectories();

        const visible = (await isAdmin(user.id)) ?
            directories :
            directories.filter(dir => {
                const perms = dir.DGPermission.filter(perm =>
                    groups.filter(grp => grp.groupId === perm.groupId)
                ).map(dir => dir.allowRead);

                return perms.some(x => x);
            });

        return await Promise.all(flatten(visible.map(x => x.File)).map(async file =>
            ({id: file.id, name: await fullName(file)})
        ));
    }
    catch(e) {
        throw { status: 500, reason: 'Failed to load file list.' };
    }
}

export type FileR = {
    name: string,
    id: ID,
    owner: ID
}
export type Dir = {
    name: string,
    id: ID,
    owner: ID,
    permissions: { read: boolean, write: boolean, create: boolean, remove: boolean },
    contents: {[key: ID]: FileR|Dir}
}

export const tree = async (req: Request, user: User) => {
    try {
        const allPerms = await isAdmin(user.id);
        const groups = (await prisma.groupUser.findMany({
            where: {
                userId: user.id
            }
        })).map(x => x.groupId)

        const dirs = (await prisma.directory.findMany({
            include: {
                DGPermission: true
            }
        })).map(dir => {
            let read = true;
            let write = true;
            let create= true;
            let rem = true;

            if(!allPerms) {
                const matching =
                    dir.DGPermission.filter(p => groups.includes(p.groupId));
                read = matching.some(x => x.allowRead);
                write = matching.some(x => x.allowWrite);
                create = matching.some(x => x.allowCreate);
                rem = matching.some(x => x.allowDelete);
            }
            return {
                id: dir.id,
                name: dir.name,
                parent: dir.parentId,
                owner: dir.ownerId,
                any: read || write || create || rem,
                perms: {
                    read: read, write: write, create: create, remove: rem
                }
            };
        });
        const res: {[key:ID]: FileR|Dir} = {}

        await seqMap(dirs.filter(dir => dir.any), async dir => {
            const files = (await prisma.file.findMany({
                where: {
                    parentId: dir.id
                }
            })).map(file => ({
                name: file.name, id: file.id, owner: file.ownerId
            }));

            const stack = [dir];
            let curr = dir;
            while(curr.parent !== null) {
                const parent =
                    dirs.find(x => x.id == curr.parent);
                if(parent === undefined) {
                    console.log(`Directory with ID ${curr.parent} does not exist.`);
                    break;
                }
                curr = parent;
                stack.push(curr);
            }

            let node = res;
            while(stack.length !== 0) {
                const d = stack.pop();
                if(node[d.id] === undefined) {
                    node[d.id] = {
                        name: d.name,
                        id: d.id,
                        owner: d.owner,
                        permissions: d.perms,
                        contents: {}
                    }
                }

                node = (node[d.id] as Dir).contents;
            }

            files.forEach(f => {
               node[f.id] = f;
            });
        });

        console.log(res);
        return res;
    }
    catch(e) {
        console.log(e);
        throw { status: 500, reason: 'Failed to load file tree.' };
    }
}