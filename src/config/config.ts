import { Path, isWindows } from "../../deps.ts";
import { defaultConfig, ConfDefault } from "./defaultConfig.ts";

export class Config {

    private homePath: string;
    private fileName = ".deno_lsl_preproc.json";

    private json = "";
    private _params:ConfDefault = defaultConfig();

    private newConfig = false;

    constructor(homePath: string) {
        this.homePath = homePath;
    }

    private get path(): string {
        return this.homePath + Path.SEP + this.fileName;
    }

    public get params() : ConfDefault {
        return this._params;
    }

    private async writeConfigFile(content: ConfDefault) {
        await Deno.writeTextFile(this.path, JSON.stringify(content, null, 2));
    }

    private async createDefaultConfig() {
        await this.writeConfigFile(defaultConfig());
    }

    public async load() {
        await this.loadConfigFile();
        const errors = this.loadMissingConfig(this.params, defaultConfig());
        await this.writeConfigFile(this.params);
        if (errors.length > 0) {
            throw `Config loaded with errors:\t` + errors.join("\n\t");
        }
        if (this.newConfig) {
            throw `New config written to '${this.path}'`;
        }
        await this.validateConfig();
    }

    private async loadConfigFile() {
        await this.loadJsonFromFile();
        await this.parseJson();
    }

    private async loadJsonFromFile() {
        try {
            this.json = await Deno.readTextFile(this.path);
        } catch (e) {
            if (e instanceof Deno.errors.NotFound) {
                this.newConfig = true;
                this.json = "{}";
            } else throw e;
        }
    }

    private async parseJson() {
        try {
            this._params = JSON.parse(this.json);
            if (typeof this.params !== "object" || this.params === null || this.params instanceof Array) {
                this._params = defaultConfig();
                throw "";
            }
        } catch (_e) {
            await this.backupJson();
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
        if (this.params.active !== true) {
            errors.push(`Config at '${this.path}' is inactive.`);
        }
        if (this.params.projectsDir.length < 1) {
            errors.push(`'projectsDir' is empty`);
        } else {
            errors.push(...(await this.testDirectory(this.params.projectsDir, "projectsDir")));
        }
        if (this.params.lsl_includes.dir.length < 1) {
            this.params.lsl_includes.dir = this.params.projectsDir;
        }
        if (this.params.lsl_includes.dir.length) {
            errors.push(...(await this.testDirectory(this.params.lsl_includes.dir, "lsl_includes.dir")));
        }

        if (this.params.preprocessor.httpCacheDir.length < 1) {
            this.params.preprocessor.httpCacheDir = Path.dirname(Deno.execPath()) + Path.SEP + "cache";
        }
        const chacheError = await this.testDirectory(this.params.preprocessor.httpCacheDir, "preprocessor.httpCacheDir");
        if (chacheError.length > 0) {
            await Deno.mkdir(this.params.preprocessor.httpCacheDir, { recursive: true });
        }
        if (isWindows) {
            if (!Path.isAbsolute(this.params.editor.path)) {
                errors.push("On windows your editor path must be absolute...");
            }
        }

        if(errors.length){
            throw errors;
        }
    }

    private loadMissingConfig(config: sObj, def: sObj, path = ""): string[] {
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
                    errors.push(...this.loadMissingConfig(confVal as sObj, value as sObj, `${path}${key}.`));
                }
            }
        }
        return errors;
    }

    private async backupJson() {
        await Deno.writeTextFile(this.path + ".bak", this.json);
        this.newConfig = true;
        throw `Config at '${this.path}' is invalid.\nBacked up to '${this.path + ".bak"}'`;
    }
}

type sType = number | null | boolean | string | sType[] | sObj | undefined;

type sObj = { [k: string]: sType };
