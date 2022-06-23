import { Preprocessor } from "./preprocessor.ts";
import { Path } from "../../deps.ts";
import { ltrim, rtrim, sha1String } from "../misc.ts";
import { StringCharStream } from "./stringCharStream.ts";

export class PPFileHandler {
    private filePath: string;
    private preprocessor: Preprocessor;
    private stack: string[];
    private integrity: string | null;

    private defines: { [k: string]: string } = {};

    private tags: { [k: string]: number } = {};

    private gotos: { [k: string]: number } = {};

    private text = "";

    private line = 0;

    private lines: string[] = [];

    private ishttp = false;

    public sha = "";

    private _prefix = "";

    private shortFilePath = "";

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

        if (!this.config.allowHttpInclude && this.ishttp) {
            throw "Https includes are not enabled";
        }
        if (this.ishttp) {
            this.shortFilePath = this.filePath;
        } else {
            this.shortFilePath = Path.relative(this.preprocessor.config.dirPath, this.filePath);
        }

        this.define("__SHORTFILE__", JSON.stringify(this.shortFilePath));
        this.define("__FILE__", JSON.stringify(this.filePath));
    }

    async process(): Promise<string> {
        this.line = 0;
        const output: string[] = [];

        await this.loadContent();

        this.lines = this.text.split("\n");

        while (this.line < this.lines.length) {
            const line = this.getLine();
            const proc = ltrim(line).toLowerCase();
            if (proc.startsWith("#tag") || proc.startsWith("#label")) {
                try {
                    await this.handleCmd(ltrim(line).substring(1), line);
                }
                catch (e) {
                    console.log("(1)Error processing line: \n-----------------------\n" + line + "\n-----------------------");
                    throw e;
                }
            }
        }

        this.line = 0;

        while (this.line < this.lines.length) {
            let line = this.getLine();
            const result = [];

            if (ltrim(line).startsWith("#")) {
                while (rtrim(line).endsWith("\\")) {
                    line += "\n" + this.getLine();
                }
                const proc = ltrim(line).substring(1);
                try {
                    const cmdRes = await this.handleCmd(proc, line);
                    result.push(...cmdRes);
                } catch (e) {
                    console.log("(2)Error processing line: \n-----------------------\n" + line + "\n-----------------------");
                    throw e;
                }
            } else {
                result.push(this.processLine(line));
            }

            output.push(...result);
        }

        return output.join("\n");
    }

    set prefix(prefix: string) {
        this._prefix = prefix + (prefix.endsWith("\n") ? "" : "\n");
    }

    get prefix(): string {
        return this._prefix;
    }

    private async getFileContent(): Promise<string> {
        if (this.ishttp) {
            let cache = this.preprocessor.getCache(this.filePath);
            if (cache) {
                return cache;
            }
            cache = await this.getUrlContent();
            this.preprocessor.cache(this.filePath, cache);
            return cache;
        } else {
            this.preprocessor.addFile(this.filePath);
            return await Deno.readTextFile(this.filePath);
        }
    }

    private get httpCachePath(): string {
        return this.config.httpCacheDir + Path.SEP + this.integrity;
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
        this.text = this.prefix + this.text;
        this.text = this.text.replaceAll("\r\n", "\n");
        this.text = this.text.replaceAll("\r", "");
    }

    private getDefine(key: string) {
        return this.defines[key] ?? this.preprocessor.getDefine(key);
    }

    private define(key: string, value: string): void {
        this.defines[key] = this.getDefine(value) ?? value;
    }

    private getLine(): string {
        const line = this.lines[this.line];
        this.line++;
        this.define("__LINE__", this.line.toString());
        return line;
    }

    private processLine(line: string, off = 0): string {
        let out = this.doProcessLine(line, off);
        let iter = 1;
        while (out !== line) {
            line = out;
            ++iter;
            // console.log(`${this.line} iteration ${iter}`);
            out = this.doProcessLine(out, off);
        }
        return out;
    }

    private doProcessLine(line: string, off = 0): string {
        const stream = new StringCharStream(line);
        let out = "";
        let stringInterp = false;
        while (!stream.eof()) {
            const char = stream.peek();
            if (char.length != 1) {
                throw "CHAR SHOULD ALWAYS BE 1";
            }
            if (this.isSymbolChar(char)) {
                const block = stream.readWhileTrue(c => this.isSymbolChar(c));
                const def = this.getDefine(block);
                // console.log(`[${this.shortFilePath} (${this.line}:${stream.position + off})]`, block, def);
                if (def) {
                    out += def;
                } else {
                    out += block;
                }
            } else if (char === '"') {
                const pos = stream.position;
                const block = stream.readQuoted();
                if (stringInterp) {
                    out += this.interpString(block, pos);
                } else {
                    out += block;
                }
            } else {
                if (char == "@") {
                    if (stream.peek(1) === '"') {
                        stringInterp = true;
                        stream.next();
                        continue;
                    }
                }
                out += stream.readWhileTrue(c => !this.isSymbolChar(c) && c !== '"' && c !== "@");
            }
            stringInterp = false;
        }
        return out;
    }

    private interpString(input: string, off: number): string {
        const stream = new StringCharStream(input);
        let interp = false;
        const blocks: string[] = [];
        let block = "";
        while (!stream.eof()) {
            const char = stream.peek();
            if (char === "$" && stream.peek(1) === "{") {
                if (interp) {
                    throw this.croakOnLine("Nested string interpolation");
                }
                interp = true;
                stream.next();
                stream.next();
                block += '"';
                blocks.push(block);
                block = "";
            } else if (interp && char === "}") {
                interp = false;
                stream.next();
                blocks.push(block);
                block = '"';
            } else {
                block += stream.next();
            }
        }
        blocks.push(block);
        if (interp) throw this.croakOnLine("Unterminated string interpolation value");
        return this.processLine("(string)[" + blocks.filter(b => b !== '""').join(", ") + "]", off);
    }

    private isSymbolChar(char: string) {
        return (/^[0-9A-Z_]{1}$/gi).test(char);
    }

    private isWhitespaceChar(char: string) {
        return (/^[\r\n\t ]{1}$/gi).test(char);
    }

    private async handleCmd(line: string, raw: string): Promise<string[]> {

        if (!line.startsWith(this.config.cmdPrefix)) {
            return [raw];
        }


        const parts = line.split(" ");
        const cmd = (parts.shift() ?? "").toLowerCase();
        const arg1 = () => {
            let arg = "";
            while (arg == "" && parts.length) {
                arg = (parts.shift() ?? "").trim();
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
            case "increment": {
                const arg = ltrim(arg1(), "_");
                const def = this.getDefine(arg);
                if (def == null) throw this.croakOnLine(`Cannot #${cmd} undefined variable`);
                if (parseInt(def).toString() !== def) throw this.croakOnLine(`Cannot #${cmd} non numeric variable`);
                this.preprocessor.define(arg, (parseInt(def) + (parseInt(parts.join(" ").trim() || "1") || 1)).toString());
                return [];
            }
            case "decrement": {
                const arg = ltrim(arg1(), "_");
                const def = this.getDefine(arg);
                if (def == null) throw this.croakOnLine(`Cannot #${cmd} undefined variable`);
                if (parseInt(def).toString() !== def) throw this.croakOnLine(`Cannot #${cmd} non numeric variable`);
                this.preprocessor.define(arg, (parseInt(def) - (parseInt(parts.join(" ").trim() || "1") || 1)).toString());
                return [];
            }
            case "tag":
            case "label": {
                const arg = arg1();
                if (arg.length > 0) {
                    this.tags[arg] = this.line;
                } else {
                    throw this.croakOnLine(`#${cmd} is missing label`);
                }
                return [];
            }
            case "goto": {
                const arg = arg1();
                this.goto(arg, cmd);
                return [];
            }
            case "ifdef": {
                const arg = arg1();
                if (arg == "") throw this.croakOnLine(`name for #${cmd} empty`);
                if (this.getDefine(arg) === null) {
                    this.advanceUntilConditionalEnd();
                }
                return [];
            }
            case "ifndef": {
                const arg = arg1();
                if (arg == "") throw this.croakOnLine(`name for #${cmd} empty`);
                if (this.getDefine(arg) !== null) {
                    this.advanceUntilConditionalEnd();
                }
                return [];
            }
            case "if": {
                const cond = parts.join(" ").trim();
                const stream = new StringCharStream(cond.trim());
                if (!this.evaluateCond(stream)) {
                    this.advanceUntilConditionalEnd();
                }
                return [];
            }
            case "ifgoto": {
                const cond = parts.join(" ").trim();
                const stream = new StringCharStream(cond.trim());
                if (this.evaluateCond(stream)) {
                    this.goto(stream.readToEnd().trim(), cmd);
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
            case "warn":
                console.warn(this.croakOnLine(this.processLine(line)));
                return [];
            case "log":
                console.log(this.croakOnLine(this.processLine(line)));
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
            case "elif":
            case "elseif":
                throw this.croakOnLine(`#${cmd} not implemented`);
            default: {
                const pp = this.config.passThroughPrefix;
                if (pp.length) {
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

    private goto(tag: string, cmd: string) {
        if (tag.length > 0) {
            let line: number = parseInt(tag) || 0;
            if (line < 1) line = this.tags[tag] ?? 0;
            if (line < 1) line = parseInt(this.getDefine(tag) ?? "0") || 0;
            if (line < 1) {
                throw this.croakOnLine(`#${cmd} references unkown tag / line '${tag}'`);
            } else {
                const count = this.gotos[line.toString()] ?? 0;
                if (count > this.config.maxGoTo) {
                    throw this.croakOnLine(`Max goto repeats reached [${this.config.maxGoTo}], cannot goto line ${line} again.`);
                }
                this.gotos[line.toString()] = count + 1;
                this.line = line - 1;
            }
        } else {
            throw this.croakOnLine(`#${cmd} is missing label`);
        }
    }

    private get config() {
        return this.preprocessor.config.params.preprocessor;
    }

    private evaluateCond(stream: StringCharStream): boolean {
        let left = stream.readWhileTrue(c => this.isSymbolChar(c));
        const mid = stream.readWhileTrue(c => !this.isSymbolChar(c)).trim();
        let right = stream.readWhileTrue(c => this.isSymbolChar(c));
        if (left === "" || right === "" || mid === "") {
            throw this.croakOnLine(`invalid condition`);
        }
        left = this.getDefine(left) ?? left;
        right = this.getDefine(left) ?? right;
        const lnum = parseInt(left);
        const rnum = parseInt(right);
        const nums = lnum.toString() === left && rnum.toString() === right;
        const notnums = this.croakOnLine(`Numerical comparison with non numerical values`);
        switch (mid) {
            case "==":
                return left === right;
            case "!=":
                return left !== right;
            case "<":
                if (!nums) throw notnums;
                return lnum < rnum;
            case "<=":
                if (!nums) throw notnums;
                return lnum <= rnum;
            case ">":
                if (!nums) throw notnums;
                return lnum > rnum;
            case ">=":
                if (!nums) throw notnums;
                return lnum >= rnum;
            case "%":
                if (!nums) throw notnums;
                return (lnum % rnum) != 0;
            case "!%":
                if (!nums) throw notnums;
                return (lnum % rnum) == 0;
            default:
                throw this.croakOnLine(`Unrecognised comparator '${mid}'`);
        }
    }

    private advanceUntilConditionalEnd() {
        let depth = 1;
        let line = "";
        while (this.line < this.lines.length) {
            line = this.getLine();
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

    private croakOnLineAndColumn(croak: string, column: number) {
        return this.croakOnLine(croak) + ` column ${column}`;
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
                + `\n// INCLUDE END - ${Path.basename(this.filePath)} ${handler.sha}`;
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
            if (this.config.allowFSStyleAbsoluteIncludes) {
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
        while (subject.length) {
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
        return [out, subject];
    }
}


class IntegrityError extends Error {
    constructor(file: string, expected: string, got: string) {
        super(`Integrity Failure:\n${file}\nHashes to: '${got}'\nExpected  : '${expected}'`);
    }
}
