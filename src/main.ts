import { Path, isWindows } from "../deps.ts";
import { Config } from "./config/config.ts";
import { InstanceConfig } from "./config/instanceConfig.ts";
import { PreProcessorContainer as PreProcContainer } from "./preprocessorContainer.ts";
import { getHomeDir } from "./misc.ts";

let listen: Deno.Listener | null = null;

const running: { [k: string]: Deno.Process } = {};

function runProc(config: InstanceConfig) {
    if (isWindows) {
        if (!Path.isAbsolute(config.params.editor.path)) {
            throw "On windows your editor path must be absolute...";
        }
    }
    if (running[config.dirPath] === undefined) {
        running[config.dirPath] = Deno.run({
            cmd: [config.params.editor.path, ...config.params.editor.args, config.dirPath]
        });
    }
    return running[config.dirPath];
}

function procEnd(config: InstanceConfig, proc: Deno.Process) {
    const old = running[config.dirPath] ?? null;
    if (old === null) return;
    if (old.pid == proc.pid) {
        delete running[config.dirPath];
        if (Object.keys(running).length < 1) {
            if (end) end();
        }
    }
}

let end: (() => void) | null = null;

function allFinished(): Promise<void> {
    return new Promise(res => {
        end = res;
    });
}

const config: Config = await loadConfig();

async function loadConfig(): Promise<Config> {
    const home = await getHomeDir();
    const config = new Config(home);
    await config.load();
    return config;
}

async function setupTcpListen(config: Config) {
    listen = Deno.listen({ port: config.params.port });
    for await (const conn of listen) {
        let b = new Uint8Array(1000);
        const n = (await conn.read(b)) || 0;
        const d = new TextDecoder();
        b = b.slice(0, n);
        const msg = d.decode(b);
        let handled = false;
        console.log("MSG: |" + msg + "|");
        prompt();
        try {
            const data = JSON.parse(msg);
            console.log(data);
            if (typeof data === "object" && data !== null && !(data instanceof Array)) {
                if (data.req === "new_preproc" && data.args instanceof Array && data.args.length > 0) {
                    startProc(data.args);
                    conn.write((new TextEncoder()).encode("okay"));
                    handled = true;
                }
            }
        } catch (e) {
            console.log(e);
        } finally {
            if (!handled) {
                conn.write((new TextEncoder()).encode("fail"));
            }
            conn.close();
        }
    }
}

async function init() {
    setupTcpListen(config)
        .then(() => console.log("setup listen over"))
        .catch(e => console.log("setup liste error", e));
    startProc(Deno.args);
    await allFinished();
    listen?.close();
}

async function startProc(args: string[]) {
    const filePath = args[0];
    const iconfig = new InstanceConfig(config, filePath);
    await iconfig.load();
    // console.log(JSON.parse(JSON.stringify(iconfig)));
    console.log("Starting new watcher: ", iconfig.filePath);
    const p = runProc(iconfig);
    const preProc = new PreProcContainer(iconfig, PreProcContainer.getPreProc(iconfig));
    preProc.start();
    await p.status();
    preProc.stop();
    procEnd(iconfig, p);
}

console.log(Deno.args.join(" "));

async function connect() {
    try {
        const con = await Deno.connect({ port: config.params.port });
        const msg = JSON.stringify(
            {
                req: "new_preproc",
                args: Deno.args,
            }
        );
        con.write((new TextEncoder()).encode(msg));

        let b = new Uint8Array(100);
        const l = (await con.read(b)) || 0;
        b = b.slice(0, l);
        const d = new TextDecoder();
        const rsp = d.decode(b);
        con.close();
        if (rsp === "okay") {
            Deno.exit();
        } else {
            throw "Host did not accept....";
        }
    } catch (e) {
        if (e instanceof Deno.errors.ConnectionRefused) {
            console.log("CON REFUSED");
            return;
        }
        console.log(e);
        prompt();
        Deno.exit();
    }
}


async function run() {
    await connect();
    await init();
    console.log("Finished");

}

try {
    await run();
} catch (e) {
    if (e instanceof Array) {
        e = "Errors:\n\t" + e.join("\n\t");
    }
    console.error(e);
    prompt("\nPress ENTER to exit.");
    Deno.exit();
}
