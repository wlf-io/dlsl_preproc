import { Preprocessor } from "./preprocessor.ts";
import { Path } from "../../deps.ts";


import { ltrim, rtrim } from "../misc.ts";

export class PPFileHandler {
    private filePath: string;
    private preprocessor: Preprocessor;
    private stack: string[];
    private integrity: string | null;

    private text = "";

    private line = 0;

    private lines: string[] = [];

    private elsed = false;

    constructor(filePath: string, preprocessor: Preprocessor, stack: string[], integrity: string | null = null) {
        this.filePath = filePath;
        this.preprocessor = preprocessor;
        this.stack = [...stack];
        this.integrity = integrity;
    }

    async process(): Promise<string> {
        this.line = 0;
        const output: string[] = [];

        this.text = await Deno.readTextFile(this.filePath);

        this.lines = this.text.split("\n");

        while (this.line < this.lines.length) {
            let line = this.lines[this.line];
            this.line++;
            this.preprocessor.define("__LINE__", this.line);
            const result = [];

            if (ltrim(line).startsWith("#")) {
                while(rtrim(line).endsWith("\\")){
                    line += "\n" + this.lines[this.line];
                    this.line++;
                }
                const proc = ltrim(line.substring(1));
                const cmdRes = await this.handleCmd(proc,line);
                result.push(...cmdRes);
            } else {
                result.push(line);
            }

            output.push(...result);
        }

        return output.join("\n");
    }

    private async handleCmd(line: string, raw:string): Promise<string[]> {

        if(!line.startsWith(this.preprocessor.config.params.preprocessor.cmdPrefix)){
            return [raw];
        }


        const parts = line.split(" ");
        const cmd = (parts.shift() ?? "").toLowerCase();
        const arg1 = () => {
            let arg = "";
            while (arg == "" && parts.length) {
                arg = parts.shift() ?? "";
            }
            return arg;
        };
        switch (cmd?.toLowerCase()) {
            case "define":
                if (parts.length > 0) {
                    const arg = arg1();
                    if (arg == "") throw this.croakOnLine(`name for #define empty`);
                    this.preprocessor.define(arg, parts.join(" ").trim());
                } else {
                    throw this.croakOnLine(`#define invalid`);
                }
                break;
            case "ifdef": {
                const arg = arg1();
                if (arg == "") throw this.croakOnLine(`name for ${cmd} empty`);
                if (this.preprocessor.getDefine(arg) === null) {
                    this.advanceUntilConditionalEnd();
                }
                return [];
            }
            case "ifndef": {
                const arg = arg1();
                if (arg == "") throw this.croakOnLine(`name for ${cmd} empty`);
                if (this.preprocessor.getDefine(arg) !== null) {
                    this.advanceUntilConditionalEnd();
                }
                return [];
            }
            case "else":
                this.advanceUntilConditionalEnd();
                return [];
            case "endif":
            case "fi":
                return [];//throw this.croakOnLine(`#endif is unpaired`);
            case "undefine":
            case "undef": {
                const arg = arg1();
                if (arg == "") throw this.croakOnLine(`name for ${cmd} empty`);
                this.preprocessor.undefine(arg);
                return [];
            }
            case "include":
                return [await this.include(parts.join(" "))];
            case "error":
                throw this.croakOnLine(line);
            case "warning":
                console.log(this.croakOnLine(line));
                return [];
            case "if":
            case "elif":
            case "elseif":
                throw this.croakOnLine(`${cmd} not implemented`);
            default: {
                const pp = this.preprocessor.config.params.preprocessor.passThroughPrefix;
                if(pp.length){
                    if (cmd?.startsWith(pp)) {
                        const ppi = raw.indexOf(pp);
                        raw = raw.substring(0, ppi) + raw.substring(ppi + pp.length);
                        return [raw];
                    }
                }
                throw this.croakOnLine(`${cmd} not recognised`);
            }
        }
        return [];
    }

    private advanceUntilConditionalEnd() {
        let depth = 1;
        let line = "";
        while (this.line < this.lines.length) {
            line = this.lines[this.line];
            this.line++;
            if (ltrim(line).startsWith("#")) {
                const cmd = (line.split(" ")[0] ?? "").toLowerCase();
                if (cmd.startsWith("#if")) {
                    depth++;
                } else if (cmd == "#else") {
                    if (depth == 1) break;
                } else if (cmd == "#endif") {
                    depth--;
                    if (depth == 0) break;
                }
            }
        }
    }

    private logLine(text: string) {
        console.log(`${this.onLine()} ${text}`);
    }

    private croakOnLine(croak: string): string {
        return `${croak.trim()} ${this.onLine()}`;
    }

    private onLine(): string {
        return `on line #${this.line} of '${Path.basename(this.filePath)}'`;
    }

    private async include(rpath: string): Promise<string> {
        let [path, rest] = this.resolvePath(rpath);
        rest = rest.trim();
        console.log("#include relative", path, rest);
        return `` +
            `// INCLUDE START ${rpath} @ ${Path.basename(this.filePath)}(${this.line}) - ${path} - [${rest}]\n`
            + ``
            + `// INCLUDE END`
        ;


        throw this.croakOnLine("#include not implemented");
        const handler = new PPFileHandler(path, this.preprocessor, this.stack);
        return await handler.process();
    }

    private resolvePath(text: string): [string, string] {
        text = ltrim(text);
        if (!text.startsWith('"')) throw this.croakOnLine("#include'd file must be quoted with \" marks");
        let [path, rest] = this.readUntilChar(text.substring(1), '"');
        if (path.startsWith("//")) {
            path = this.preprocessor.config.params.lsl_includes.path + Path.SEP + ltrim(path, "/");
        } else if (path.startsWith("/")) {
            if (this.filePath.toLowerCase().startsWith("https://")) {
                return [Path.dirname(this.filePath) + Path.SEP + path, rest];
            }
            path = this.preprocessor.config.instance.dirPath + Path.SEP + ltrim(path, "/");
        } else if (path.startsWith(".")) {
            path = Path.dirname(this.filePath) + Path.SEP + path;
            if (this.filePath.toLowerCase().startsWith("https://")) {
                return [path,rest];
            }
        } else if (path.startsWith("https://")) {
            return [path,rest];
        } else {
            throw this.croakOnLine(`#inlcude path invalid`);
        }
        return [Path.normalize(path), rest];
    }

    private readUntilChar(subject: string, char: string, escape = "\\") {
        let out = "";
        let escaped = false;
        while(subject.length) {
            const c = subject.charAt(0);
            subject = subject.substring(1);
            if (escaped) {
                escaped = false;
            } else {
                if (c === escape) {
                    escaped = true;
                } else if (c === char) {
                    break;
                }
            }
            out += c;
        }
        return [out,subject];
    }
}
