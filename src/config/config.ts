import { Path } from "../../deps.ts";
import {defaultConfig, ConfDefault } from "./defaultConfig.ts";
import {InstanceConfig} from "./instanceConfig.ts";

export class Config {

    private homePath: string;
    private fileName = ".deno_lsl_preproc.json";

    private json = "";
    private _params:ConfDefault = defaultConfig();

    private _inststance:InstanceConfig;


    constructor(homePath: string, lslFilePath:string) {
        this.homePath = homePath;
        this._inststance = new InstanceConfig(this, lslFilePath);
    }

    private get path(): string {
        return this.homePath + Path.SEP + this.fileName;
    }

    public get instance() : InstanceConfig {
        return this._inststance;
    }

    public get params() : ConfDefault {
        return this._params;
    }

    private async writeConfigFile(content: { [k: string]: any }) {
        await Deno.writeTextFile(this.path, JSON.stringify(content, null, 2));
    }

    private async createDefaultConfig() {
        await this.writeConfigFile(defaultConfig());
    }

    public async load() {
        await this.loadJsonFromFile();
        await this.parseJson();
        const errors = this.loadMissingConfig(this._params, defaultConfig());
        await this.writeConfigFile(this._params);
        if (errors.length > 0) {
            throw `Config loaded with errors:\t` + errors.join("\n\t");
        }
        await this.validateConfig();
        await this._inststance.load();
    }

    private async loadJsonFromFile() {
        try {
            this.json = await Deno.readTextFile(this.path);
        } catch (e) {
            if (e instanceof Deno.errors.NotFound) {
                await this.createDefaultConfig();
                throw `Output config file to ${this.path}. Please read it and configure. Set active to true when ready.`;
            } else throw e;
        }
    }

    private async parseJson() {
        try {
            this._params = JSON.parse(this.json);
            if (typeof this._params !== "object" || this._params === null || this._params instanceof Array) {
                throw "";
            }
        } catch (_e) {
            await this.backupJsonAndCreateNewDefault();
        }
    }

    private async testDirectory(path:string, type:string):Promise<string[]>{
        try{
            await Deno.stat(path);
        } catch(e){
            if(e instanceof Deno.errors.NotFound){
                return [`'${type}' points to unavailable path '${path}'`];
            } else {
                console.log(e);
                throw e;
            }
        }
        return [];
    }

    private async validateConfig() {
        const errors:string[] = [];
        if (this._params.active !== true) {
            errors.push(`Config at '${this.path}' is inactive.`);
        }
        if(this.params.projectsPath.length < 1){
            errors.push(`'projectsPath' is empty`);
        } else {
            errors.push(...(await this.testDirectory(this.params.projectsPath,"projectsPath")));
        }
        if(this._params.lsl_includes.path.length < 1){
            this.params.lsl_includes.path = this.params.projectsPath;
        }
        errors.push(...(await this.testDirectory(this.params.lsl_includes.path,"lsl_includes.path")));

        if(errors.length){
            throw errors;
        }
    }

    private loadMissingConfig(config: { [k: string]: any }, def: { [k: string]: any }, path = ""): string[] {
        const errors = [];
        for (const [key, value] of Object.entries(def)) {
            const confVal = config[key];
            if (confVal === undefined || key.startsWith("__")) {
                config[key] = JSON.parse(JSON.stringify(value));
            } else {
                if (typeof value !== typeof confVal) {
                    errors.push(`Config path ${path + key} has type of [${typeof confVal}], expected [${typeof value}]`);
                } else if (value instanceof Array && !(confVal instanceof Array)) {
                    errors.push(`Config path ${path + key} expected to be an [Array]`);
                } else if (confVal === null) {
                    errors.push(`Config path ${path + key} expected not to be [null]`);
                } else if (typeof value === "object" && !(value instanceof Array)) {
                    errors.push(...this.loadMissingConfig(confVal, value, `${path}${key}.`));
                }
            }
        }
        return errors;
    }

    private async backupJsonAndCreateNewDefault() {
        await Deno.writeTextFile(this.path + ".bak", this.json);
        await this.createDefaultConfig();
        throw `Config at '${this.path}' is invalid.\nBacked up to '${this.path + ".bak"}'\nA fresh config has been created.`;
    }
}
