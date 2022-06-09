import { Path, isWindows } from "../deps.ts";
import { Config } from "./config/config.ts";
import { Watcher } from "./watcher.ts";
import {PreProcessorContainer} from "./preprocessorContainer.ts";
import type {iPreprocessor} from "./interfaces.d.ts";
import {ExternalPreprocessor} from "./externalPreprocessor.ts";
import {Preprocessor} from "./preprocessor/preprocessor.ts";

function getHomeDir(): Promise<string> {
    const home = Deno.env.get("HOME") || Deno.env.get("HOMEPATH");
    if (typeof home != "string" || home.length < 1) {
        throw "Failed to locatie home directory...";
    }
    return Promise.resolve(home);
}


async function readLSL(filePath: string) {
    console.log(filePath);
    const file = await Deno.open(filePath);
    console.log("Spl:", filePath.split(Path.SEP));
    console.log("Dir:", Path.dirname(filePath));
    console.log("Nsp:", Path.toNamespacedPath(filePath));
    console.log("Abs:", Path.isAbsolute(filePath));
}

function runProc(config: Config) {
    if (isWindows) {
        if (!Path.isAbsolute(config.params.editor.path)) {
            throw "On windows your editor path must be absolute...";
        }
    }
    return Deno.run({
        cmd: [config.params.editor.path, ...config.params.editor.args, config.instance.dirPath]
    });

}


/*



    private async processLSL(): Promise<string> {

        if (this.config.params.preprocessor.override.enabled) {
            return await this.runExternalPreProcessor();
        }

        return await Deno.readTextFile(this.filePath);
    }

    private async runExternalPreProcessor(): Promise<string> {
        const override = this.config.params.preprocessor.override;
        const p = Deno.run({
            cmd: [override.path, ...override.args]
        });
        const s = await p.status();
        if (s.success) return "";
        else throw "External Preproc Failed";
    }


*/

function getPreProc(config: Config) : iPreprocessor {
    if(config.params.preprocessor.override.enabled){
        return new ExternalPreprocessor(config.params.preprocessor.override);
    } else {
        return new Preprocessor(config);
    }   
}


async function init() {
    const filePath = Deno.args[0];
    console.log(filePath);
    const home = await getHomeDir();
    const config = new Config(home, filePath);
    await config.load();

    const p = runProc(config);

    const preProc = new PreProcessorContainer(config, getPreProc(config));

    const watcher = new Watcher(config);

    watcher.hook(()=>{
        preProc.process();
    });

    watcher.start();

    await p.status();

    watcher.stop();
}

console.log(Deno.execPath());

init()
    // .then(conf => console.log(conf))
    // .then(() => prompt("next?"))
    .catch(e => {
        if (e instanceof Array) {
            e = "Errors:\n\t" + e.join("\n\t");
        }
        console.error(e);
        prompt("\nPress ENTER to exit.");
        Deno.exit();
    });
