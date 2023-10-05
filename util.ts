export const sequential = async <T>(p: Promise<T>[]) => {
    const accumulator: T[] = [];

    for(const prom of p) {
        accumulator.push(await prom);
    }

    return accumulator;
}

export const seqMap = async <T, R>(set: T[], f: (v: T) => Promise<R>)=> {
    const accumulator: R[] = [];

    for(const v of set) {
        accumulator.push(await f(v));
    }

    return accumulator;
}