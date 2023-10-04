import {LoadCache} from "./env";

const createTree = async (target: string) => {
    const nodes = target.split('/');
    let parent: number|null = null;
    for(const node of nodes) {

    }
};

export const importer = async (cache: LoadCache) => {
    await Promise.all(cache.map(async entry => {
        //
    }));
}