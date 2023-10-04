import * as config from "../config.json";
import fs from "fs";
import {Request, Response} from "express";
import {groupsFor, isAdmin, prisma, User} from "../db";
import {File} from "@prisma/client";
import {storage} from "../env";

export const getFile = async (req: Request, res: Response, user: User) => {
    const id = req.params['id'];
    if(id == undefined) throw { status: 400, reason: 'No file ID provided' };

    let file: File;
    try {
        file = await prisma.file.findUnique({ where: { id: +id } });
        const dir = await prisma.directory.findUnique({ where: { id: file.parentId } });
        const perms = await prisma.permission.findMany({ where: { dirId: dir.id } });
        const groups = (await groupsFor(user.id)).map(x => x.groupId);

        if(await isAdmin(user.id) || perms
            .filter(p => groups.includes(p.groupId))
            .some(p => p.allowRead)
        ) {
            const content = fs.readFileSync(`${storage}/${id}.cml`);
            res.contentType('text/cml');
            return content.toString();
        }
        else {
            throw '';
        }
    }
    catch(e) {
        throw { status: 404, reason: `File with ID ${id} does not exist.` };
    }
}