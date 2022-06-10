import type { InstanceConfig, ConfInstance } from "../config/instanceConfig.ts";
import type {iPreprocessor} from "../interfaces.d.ts";
import {PPFileHandler} from "./PPFileHandler.ts";
import { setObjValueByPath } from "../hack.js";

export class Preprocessor implements iPreprocessor {
    private _config: InstanceConfig;

    private rconf: ConfInstance;

    private defines : {[k:string]:string|number|null} = {};

    private files: string[] = [];

    constructor(config: InstanceConfig) {
        this._config = config;
        this.defaultDefines();
        this.rconf = JSON.parse(JSON.stringify(this._config.def));
    }

    get config(): ConfInstance {
        return this.rconf;
    }

    private reset() {
        this.rconf = JSON.parse(JSON.stringify(this._config.def));
        this.defines = {};
        this.defaultDefines();
        this.files = [];
    }
    
    async processFile(filePath: string) : Promise<string> {
        this.reset();
        const fileHandler = new PPFileHandler(filePath,this,[]);
        return await fileHandler.process();
    }

    getUsedFiles(): string[] {
        return [...this.files];
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

    addFile(file: string): void {
        this.files.push(file);
    }

    setConf(param: string | string[], value: sType): void {
        if (typeof value === "object" && !(value instanceof Array)) {
            throw "Can only set simple value types";
        }
        setObjValueByPath(param, value, this.config.params);
    }

    private defaultDefines(){
        this.define("__UNIXTIME__",Math.floor(Date.now() * 0.001));
    }
}

type sType = string | number | null | sType[];
