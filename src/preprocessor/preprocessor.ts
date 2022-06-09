import type {Config} from "../config/config.ts";
import type {iPreprocessor} from "../interfaces.d.ts";
import {PPFileHandler} from "./PPFileHandler.ts";

export class Preprocessor implements iPreprocessor {
    private _config : Config;

    private defines : {[k:string]:string|number|null} = {};

    constructor(config:Config) {
        this._config = config;
        this.defaultDefines();
    }

    get config():Config {
        return this._config;
    }
    
    async processFile(filePath: string) : Promise<string> {
        const fileHandler = new PPFileHandler(filePath,this,[]);
        return await fileHandler.process();
    }

    getDefine(key:string) : string|number|null {
        return this.defines[key] ?? null;
    }

    define(key:string, value:string|number) : void {
        this.defines[key] = value;
    }

    undefine(key:string) : void {
        this.defines[key] = null;
    }

    private defaultDefines(){
        this.define("__UNIXTIME__",Math.floor(Date.now() * 0.001));
    }
}
