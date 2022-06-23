import type { InstanceConfig, ConfInstance } from "../config/instanceConfig.ts";
import type {iPreprocessor} from "../interfaces.d.ts";
import {PPFileHandler} from "./PPFileHandler.ts";
import { setObjValueByPath } from "../hack.js";

export class Preprocessor implements iPreprocessor {
    private _config: InstanceConfig;

    private rconf: ConfInstance;

    private _cache: { [k: string]: string } = {};

    private defines: { [k: string]: string | null } = {};

    private files: string[] = [];

    private allwaysInclude = "";

    constructor(config: InstanceConfig) {
        this._config = config;
        this.defaultDefines();
        this.rconf = JSON.parse(JSON.stringify(this._config.def));

        this.allwaysInclude = this.config.params.lsl_includes.globalInclude;
        if (this.allwaysInclude.length) {
            while (!this.allwaysInclude.startsWith("//")) {
                this.allwaysInclude = "/" + this.allwaysInclude;
            }
            this.allwaysInclude = `#include "${this.allwaysInclude}"`;
        }

    }

    get config(): ConfInstance {
        return this.rconf;
    }

    private reset() {
        this.rconf = JSON.parse(JSON.stringify(this._config.def));
        this.defines = {};
        this.defaultDefines();
        this.files = [];
        this._cache = {};
    }
    
    async processFile(filePath: string) : Promise<string> {
        this.reset();
        const fileHandler = new PPFileHandler(filePath,this,[]);
        fileHandler.prefix = this.allwaysInclude;
        return await fileHandler.process();
    }

    cache(key: string, value: string): void {
        this._cache[key] = value;
    }

    getCache(key: string): string | null {
        return this._cache[key] ?? null;
    }

    getUsedFiles(): string[] {
        return [...this.files];
    }

    getDefine(key: string): string | null {
        return this.defines[key] ?? null;
    }

    define(key: string, value: string): void {
        // console.log("Define:", key, value);
        this.defines[key] = this.getDefine(value) ?? value;
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
        this.define("__UNIXTIME__", Math.floor(Date.now() * 0.001).toString());
    }
}

type sType = string | number | null | sType[];
