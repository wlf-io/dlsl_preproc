import type { InstanceConfig } from "../config/instanceConfig.ts";
import type {iPreprocessor} from "../interfaces.d.ts";
import {PPFileHandler} from "./PPFileHandler.ts";

export class Preprocessor implements iPreprocessor {
    private _config: InstanceConfig;

    private defines : {[k:string]:string|number|null} = {};

    private files: string[] = [];

    constructor(config: InstanceConfig) {
        this._config = config;
        this.defaultDefines();
    }

    get config(): InstanceConfig {
        return this._config;
    }
    
    async processFile(filePath: string) : Promise<string> {
        this.files = [];
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

    private defaultDefines(){
        this.define("__UNIXTIME__",Math.floor(Date.now() * 0.001));
    }
}
