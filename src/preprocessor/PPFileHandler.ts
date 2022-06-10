import { Preprocessor } from "./preprocessor.ts";
import { Path } from "../../deps.ts";
import { ltrim, rtrim, sha1String } from "../misc.ts";

export class PPFileHandler {
    private filePath: string;
    private preprocessor: Preprocessor;
    private stack: string[];
    private integrity: string | null;

    private text = "";

    private line = 0;

    private lines: string[] = [];

    private ishttp = false;

    public sha = "";

    constructor(filePath: string, preprocessor: Preprocessor, stack: string[], integrity: string | null = null) {
        this.filePath = filePath;
        this.ishttp = this.filePath.toLowerCase().startsWith("https://");

        this.preprocessor = preprocessor;
        if (stack.filter(f => f == filePath).length > 10) {
            throw "Recusive include??? depth passed 10";
        }
        this.stack = [...stack, this.filePath];
        integrity = (integrity ?? "").trim().toLowerCase();
        if (integrity.length > 0) {
            if ((/^[0-9a-f]{40}$/i).test(integrity)) {
                this.integrity = integrity;
            } else {
                throw "Invalid integrity string";
            }
        } else {
            this.integrity = null;
        }

        if (!this.preprocessor.config.params.preprocessor.allowHttpInclude && this.ishttp) {
            throw "Https includes are not enabled";
        }
    }

    private async getFileContent(): Promise<string> {
        if (this.ishttp) {
            return await this.getUrlContent();
        } else {
            this.preprocessor.addFile(this.filePath);
            return await Deno.readTextFile(this.filePath);
        }
    }

    private get httpCachePath(): string {
        return this.preprocessor.config.params.preprocessor.httpCacheDir + Path.SEP + this.integrity;
    }

    private async getUrlContent(): Promise<string> {
        if (this.integrity) {
            try {
                return await Deno.readTextFile(this.httpCachePath);
            } catch (e) {
                if (!(e instanceof Deno.errors.NotFound)) {
                    throw e;
                }
            }
        }
        const req = await fetch(this.filePath);
        const text = await req.text();
        this.sha = await sha1String(text);
        return text;
    }

    private async loadContent(): Promise<void> {
        this.text = await this.getFileContent();
        if (this.integrity) {
            this.sha = await sha1String(this.text);
            if (this.sha != this.integrity) {
                throw new IntegrityError(this.filePath, this.integrity, this.sha);
            }
            if (this.ishttp) {
                await Deno.writeTextFile(this.httpCachePath, this.text);
            }
        }
    }

    async process(): Promise<string> {
        this.line = 0;
        const output: string[] = [];

        this.text = await this.getFileContent();



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
                if (arg == "") throw this.croakOnLine(`name for #${cmd} empty`);
                if (this.preprocessor.getDefine(arg) === null) {
                    this.advanceUntilConditionalEnd();
                }
                return [];
            }
            case "ifndef": {
                const arg = arg1();
                if (arg == "") throw this.croakOnLine(`name for #${cmd} empty`);
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
                if (arg == "") throw this.croakOnLine(`name for #${cmd} empty`);
                this.preprocessor.undefine(arg);
                return [];
            }
            case "include":
                return [await this.include(parts.join(" "))];
            case "error":
                throw this.croakOnLine(line);
            case "warning":
                console.warn(this.croakOnLine(line));
                return [];
            case "config":
            case "conf": {
                try {
                    const param = arg1();
                    const val = JSON.parse(parts.join(" ").trim());
                    this.preprocessor.setConf(param, val);
                } catch (e) {
                    throw this.croakOnLine(`#${cmd} failed, ${e.toString()}`);
                }
                return [];
            }
            case "if":
            case "elif":
            case "elseif":
                throw this.croakOnLine(`#${cmd} not implemented`);
            default: {
                const pp = this.preprocessor.config.params.preprocessor.passThroughPrefix;
                if(pp.length){
                    if (cmd?.startsWith(pp)) {
                        const ppi = raw.indexOf(pp);
                        raw = raw.substring(0, ppi) + raw.substring(ppi + pp.length);
                        return [raw];
                    }
                }
                throw this.croakOnLine(`#${cmd} not recognised`);
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

    private croakOnLine(croak: string, trim = true): string {
        if (trim) croak = croak.trim();
        return `${croak} ${this.onLine()}`;
    }

    private onLine(): string {
        return `on line #${this.line} of '${Path.basename(this.filePath)}'`;
    }

    private async include(rpath: string): Promise<string> {
        let [path, opath, rest] = this.resolvePath(rpath);
        rest = rest.trim();

        try {
            const handler = new PPFileHandler(path, this.preprocessor, [...this.stack], rest);
            return `` +
                `// INCLUDE START '${opath}' @ ${Path.basename(this.filePath)}(${this.line})\n`
                + (await handler.process())
                + `// INCLUDE END - ${handler.sha}`;
        } catch (e) {
            if (e instanceof Deno.errors.NotFound) {
                throw this.croakOnLine(`Cannot find '${opath}' to include`);
            }
            if (e instanceof IntegrityError) {
                throw this.croakOnLine(`#include ${e.message}`);
            } else if (typeof e == "string") {
                throw this.croakOnLine(e + "\n", false);
            }
            throw e;
        }
    }

    private resolvePath(text: string): [string, string, string] {
        text = ltrim(text);
        if (!text.startsWith('"')) throw this.croakOnLine("#include'd file must be quoted with \" marks");
        let [path, rest] = this.readUntilChar(text.substring(1), '"');
        const opath = path + "";
        if (path.startsWith("//")) {
            if (this.ishttp) throw this.croakOnLine("Http includes cannot use include dir absolute paths");
            path = this.preprocessor.config.params.lsl_includes.dir + Path.SEP + ltrim(path, "/");
        } else if (path.startsWith("/")) {
            if (this.ishttp) {
                return [Path.dirname(this.filePath) + Path.SEP + path, opath, rest];
            }
            path = this.preprocessor.config.dirPath + Path.SEP + ltrim(path, "/");
        } else if (path.startsWith(".")) {
            path = Path.dirname(this.filePath) + Path.SEP + path;
            if (this.ishttp) {
                return [path, opath, rest];
            }
        } else if (path.startsWith("https://")) {
            return [path, opath, rest];
        } else if (path.startsWith("http://")) {
            throw this.croakOnLine("#include with non secure url");
        } else {
            if (this.preprocessor.config.params.preprocessor.allowFSStyleAbsoluteIncludes) {
                path = this.preprocessor.config.params.lsl_includes.dir + Path.SEP + path;
            } else {
                throw this.croakOnLine(`#inlcude path '${opath}' is invalid`);
            }
        }
        return [Path.normalize(path), opath, rest];
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


class IntegrityError extends Error {
    constructor(file: string, expected: string, got: string) {
        super(`Integrity Failure:\n${file}\nHashes to: '${got}'\nExpected  : '${expected}'`);
    }
}
