import type { InstanceConfig } from "./config/instanceConfig.ts";
import { sha1String } from "./misc.ts";

export class Watcher {
    private filePath: string;
    private watcher: Deno.FsWatcher | null = null;

    private timers: WatcherTimers = {
        "any": null,
        "access": null,
        "create": null,
        "modify": null,
        "remove": null,
        "other": null,
    };

    private hooks: WatcherHooks = {
        "any": [],
        "access": [],
        "create": [],
        "modify": [],
        "remove": [],
        "other": [],
    };

    private _files: string[] = [];

    private lastHash = "";

    constructor(config: InstanceConfig) {
        this.filePath = config.filePath;
    }

    get files(): string[] {
        const files = [this.filePath, ...this._files];
        files.sort();
        return files;
    }

    async getHash(): Promise<string> {
        return await sha1String(JSON.stringify(this.files));
    }

    private callHooks(event: FSEventKind) {
        const timer = this.timers[event];
        if (timer !== null) {
            self.clearTimeout(timer);
        }
        this.timers[event] = self.setTimeout(() => {
            this.timers[event] = null;
            this.hooks[event].forEach(h => h());
        }, 2000);
    }

    async start() {
        this.watcher = Deno.watchFs(this.files);
        for await (const event of this.watcher) {
            this.callHooks(event.kind);
        }
    }

    public hookModify(cb: () => void) {
        this.hook("modify", cb);
    }

    public hook(event: FSEventKind, cb: () => void) {
        this.hooks[event].push(cb);
    }

    async addFiles(files: string[]): Promise<void> {
        this._files = [...files].filter((v, i, a) => a.indexOf(v) === i);
        if (this.watcher) {
            const hash = await this.getHash();
            if (hash !== this.lastHash) {
                this.lastHash = hash;
                this.stop();
                this.start();
            }
        }
    }

    stop() {
        this.watcher?.close();
    }
}

type WatcherHooks = {
    "any": CB[];
    "access": CB[];
    "create": CB[];
    "modify": CB[];
    "remove": CB[];
    "other": CB[];
}

type WatcherTimers = {
    "any": number | null;
    "access": number | null;
    "create": number | null;
    "modify": number | null;
    "remove": number | null;
    "other": number | null;
}

type CB = () => void;
type FSEventKind = keyof WatcherHooks;
