import { Config } from "./config/config.ts";
import { InstanceConfig } from "./config/instanceConfig.ts";
import { PreProcessorContainer as PreProcContainer } from "./preprocessorContainer.ts";
import { getHomeDir } from "./misc.ts";
import { VERSION } from "./version.ts";
import { FileDeleteWatcher } from "./fileDeleteWatcher.ts";

let listen: Deno.Listener | null = null;

const running: { [k: string]: Deno.Process } = {};


function runProc(config: InstanceConfig) {
    if (running[config.filePath] === undefined) {
        running[config.filePath] = Deno.run({
            cmd: [config.params.editor.path, ...config.params.editor.args, config.dirPath]
        });
    }
    return running[config.filePath];
}

function procEnd(config: InstanceConfig, proc: Deno.Process) {
    const old = running[config.filePath] ?? null;
    if (old === null) return;
    if (old.pid == proc.pid) {
        console.log("Instance End:", config.filePath);
        delete running[config.filePath];
        if (Object.keys(running).length < 1) {
            if (end) end();
        } else {
            console.log(Object.keys(running).length, "instances left");
        }
    }
}

function updateCheck() {
    if (VERSION == ("develop" + "")) return;
    const repoUrl = "https://github.com/wlf-io/dlsl_preproc".toLowerCase();
    fetch(repoUrl + "/releases/latest/", { redirect: "manual" })
        .then(r => {
            if (r.status === 302) {
                const loc = (r.headers.get("location") ?? "").toLowerCase().trim();
                if (loc.startsWith(repoUrl + "/releases/tag/v")) {
                    const end = (loc.split("/").pop() ?? "").toLowerCase();
                    if (end !== VERSION) {
                        console.log("New Version Available: " + loc);
                    }
                }
            }
        })
        .catch(_e => { });
}

let end: (() => void) | null = null;

function allFinished(): Promise<void> {
    return new Promise(res => {
        end = res;
    });
}

const config: Config = await loadConfig();

async function loadConfig(): Promise<Config> {
    try {
        const home = await getHomeDir();
        const config = new Config(home);
        await config.load();
        return config;
    } catch (e) {
        if (e instanceof Array) {
            console.log("\nConfig Errors:\n\t" + e.join("\n\t"));
        } else {
            console.log(e);
        }
        alert("\nConfig load failed....");
        Deno.exit();
    }
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
        try {
            const data = JSON.parse(msg);
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

const files: string[] = [];

async function startProc(args: string[]) {
    const filePath = args[0];
    if (files.includes(filePath)) {
        console.log("Already Watching file");
        return;
    }
    files.push(filePath);
    const iconfig = new InstanceConfig(config, filePath);
    await iconfig.load();
    // console.log(JSON.parse(JSON.stringify(iconfig)));
    console.log("Starting new watcher: ", iconfig.filePath);
    const p = runProc(iconfig);
    const preProc = new PreProcContainer(iconfig, PreProcContainer.getPreProc(iconfig));


    const fd = new FileDeleteWatcher(filePath);

    preProc.start();
    await Promise.race([p.status(), fd.watch()]);
    preProc.stop();
    fd.stop();
    p.close();
    procEnd(iconfig, p);
}

console.log("dlsl preprocessor " + VERSION);
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
            return;
        }
        console.log(e);
        alert("\nConnection Error...");
        Deno.exit();
    }
}


async function run() {
    await connect();
    updateCheck();
    await init();
    console.log("Finished");
    throw "e";
    //Deno.exit();
}

try {
    await run();
} catch (e) {
    if (e instanceof Array) {
        console.error("Errors:\n\t" + e.join("\n\t"));
    } else {
        console.error(e);
    }
    alert("PreProc Error...");
    Deno.exit(1);
}
