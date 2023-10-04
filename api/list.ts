import {Request} from "express";
import {groupsFor, isAdmin, listDirectories, prisma, User} from "../db";
import {Directory, File} from "@prisma/client";

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