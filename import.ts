import {LoadCache, storage} from "./env";
import {everyoneGroup, ID, mkdir, mkPerms, Perms, prisma} from "./db";
import {copyFileSync, readdirSync} from "fs";
import {seqMap} from "./util";

const createTree = async (target: string, owner: ID, perms: Perms) => {
    const nodes = target.split('/');
    let parent: ID|null = null;
    for(const node of nodes) {
        if(node === '') continue;

        let curr = await prisma.directory.findFirst({
            where: {
                name: node,
                parentId: parent
            }
        });

        if(curr === null) {
            curr = await mkdir(node, parent, owner, perms);
        }

        parent = curr.id;
    }

    return parent; // last created directory
};

const importFile = async (file: string, parent: ID, owner: ID) => {
    const dbFile = await prisma.file.create({
        data: {
            name: file.split('/').pop(),
            parentId: parent,
            ownerId: owner
        }
    });
    copyFileSync(file, `${storage}/${dbFile.id}.cml`);
};

const list = async (dir: string, id: ID, owner: ID, recurse: boolean, perms: Perms) => {
    await seqMap(readdirSync(dir, { withFileTypes: true }), async elem => {
        const path = `${elem.path}/${elem.name}`
        if(elem.isFile()) {
            if(elem.name.endsWith('.cml')) {
                console.log(`Importing ${path} into database.`);
                await importFile(path, id, owner);
            }
            else {
                console.log(`Not importing entry ${path}. It's not a CML file.`);
            }
        }
        else if(elem.isDirectory()) {
            if(recurse) {
                if(!elem.name.startsWith('.')) {
                    console.log(`Recurring into ${path}, allow read? ${perms.groups[everyoneGroup()].rd}`);
                    await list(path, (await mkdir(elem.name.split('/').pop(), id, owner, perms)).id, owner, recurse, perms);
                }
                else {
                    console.log(`Ignoring hidden directory ${path}.`);
                }
            }
            else {
                console.log(`Entry ${path} is a directory, but recursive iteration is disabled.`);
            }
        }
        else {
            console.log(`Entry ${path} is of an unsupported type.`);
        }
    });
}

export const importer = async (cache: LoadCache, owner: ID, everyone: ID) => {
    const read = mkPerms().addRead(everyone);
    const none = mkPerms().addNone(everyone);

    await seqMap(cache, async entry => {
        const perms = entry.readable ? read : none;
        const dirId = await createTree(entry.target, owner, perms);
        console.log(`Importing ${entry.target} (ID: ${dirId}). Recursive? ${entry.recursive}; readable? ${entry.readable}`);
        await list(entry.source, dirId, owner, entry.recursive, perms);
    });
}