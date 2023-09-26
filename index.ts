import express, {Request, Router} from 'express';
import * as fs from 'fs';
import * as config from './config.json';

const app = express();
const router = Router();

type Tree = { [key: string]: string|Tree|{error: string} };

const tree = (dir: string, prefix: string = '') => {
    const res: Tree = {};
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
        if(entry.isFile()) {
            if(entry.name.endsWith('.cml')) res[entry.name] = `${prefix}${entry.name}`;
        }
        else if(entry.isDirectory()) {
            const sub = tree(`${dir}/${entry.name}`, `${prefix}${entry.name}/`);
            if(Object.keys(sub).length !== 0) res[entry.name] = sub;
        }
        else res[entry.name] = { error: `Entry ${entry.name} is of an unknown type (perhaps a symlink or FIFO?).` };
    });

    return res;
}

router.get("/list", (req, res) => {
    res.json(tree(config.scripts, ''));
});

router.get("/file/:name*", (req, res) => {
    const name = req.params['name'] + req.params['0'];
    const file = `${config.scripts}/${name}`;
    try {
        const content = fs.readFileSync(file).toString();
        res.status(200).send(content);
    }
    catch(e) {
        res.status(404).send();
    }
});

app.use(router);

app.listen(config.port, () => console.log(`Server ready (port ${config.port}).`));
