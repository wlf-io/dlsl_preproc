import { ltrim } from "../misc.ts";
import type { Config } from "./config.ts";
import {Path} from "../../deps.ts";
import type { ConfDefault } from "./defaultConfig.ts";

export class InstanceConfig {
    private _lslFile: string;
    private _config: Config;

    private dir: null | string = null;
    private file: null | string = null;

    private noDir = false;
    private noFile = false;

    constructor(config: Config, lslFile: string) {
        this._config = config;
        this._lslFile = lslFile;
    }

    get config(): Config {
        return this._config;
    }

    get params() {
        return this.config.params;
    }

    get lslFile():string{
        return this._lslFile;
    }

    get filePath():string {
        return `${this.dirPath}${this.file}`;
    }

    get dirPath():string {
        return `${this.params.projectsDir}${Path.SEP}${this.dir}${Path.SEP}`;
    }

    get project():string{
        return this.dir || "";
    }

    get main():string {
        return this.file || "";
    }

    get def(): ConfInstance {
        return {
            params: this.params,
            lslFile: this.lslFile,
            filePath: this.filePath,
            dirPath: this.dirPath,
            main: this.main,
            project: this.project,
        };
    }

    toJSON() {
        return this.def;
    }

    async load() {
        await this.readLsl();
        await this.validate();
    }

    private async validate() {
        if(this.dir == null){
            this.noDir = true;
            this.dir = prompt("Project name?");
        }
        if(this.file == null){
            this.noFile = true;
            this.file = "main.lsl";
        }
        if(this.dir == null){
            prompt
            throw [
                "Dlsl PreProc requires a comment at the start of a file in the following format:",
                "//#dlsl_dir <dir>",
                "//#dlsl_file <file>",
                "Where <dir> is a directory path INSIDE your configured includes path",
                "And <file> is a file path INSIDE the <dir> path",
            ].join("\n");
        }
        await this.validateFile();
    }

    private async validateFile(){
        try {
            await Deno.stat(this.filePath);
            console.log(`${this.filePath} Exists`);
        } catch(e){
            if(e instanceof Deno.errors.NotFound){
                await Deno.mkdir(this.dirPath,{recursive: true, mode: 0o775});
                const content = (await Deno.readTextFile(this.lslFile))
                    .split("\n")
                    .filter(line => {
                        const l = ltrim(line, " /").toLowerCase();
                        return !l.startsWith("#dlsl");
                    }).join("\n");
                await Deno.writeTextFile(this.filePath, content);
            } else {
                throw e;
            }
        }
    }

    private async readLsl(){
        let lines = (await Deno.readTextFile(this.lslFile)).split("\n");
        lines = lines.map(line => {
            return ltrim(line, "/ ");
        }).filter(line => {
            return line.startsWith("#dlsl")
        });

        for (const line of lines) {
            const parts = line.split(" ")
                .map(p => p.trim())
                .filter(p => p.length);
            if (parts.length == 2) {
                switch (parts[0].toLowerCase()) {
                    case "#dlsl_dir":
                        this.dir = parts[1] || null;
                        break;
                    case "#dlsl_file":
                        this.file = parts[1] || null;
                        break;
                }
            }
        }
    }
}


export type ConfInstance = {
    params: ConfDefault,
    lslFile: string,
    filePath: string,
    dirPath: string,
    main: string,
    project: string,
}
