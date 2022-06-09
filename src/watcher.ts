import type { InstanceConfig } from "./config/instanceConfig.ts";

export class Watcher {
    private filePath: string;
    private watcher: Deno.FsWatcher | null = null;

    private timeout: number | null = null;

    private hooks: (() => void)[] = [];

    private _files: string[] = [];

    constructor(config: InstanceConfig) {
        this.filePath = config.filePath;
    }

    get files(): string[] {
        return [this.filePath, ...this._files];
    }

    private callHooks() {
        if (this.timeout) {
            self.clearTimeout(this.timeout);
        } else {
            console.log("Save detected...");
        }
        this.timeout = self.setTimeout(() => {
            this.timeout = null;
            this.hooks.forEach(h => h());
        }, 2000);
    }

    async start() {
        this.watcher = Deno.watchFs(this.files);
        for await (const event of this.watcher) {
            if (event.kind == "modify") {
                this.callHooks();
            }
        }
    }

    public hook(cb: () => void) {
        this.hooks.push(cb);
    }

    addFiles(files: string[]): void {
        this._files = [...files].filter((v, i, a) => a.indexOf(v) === i);
        if (this.watcher) {
            this.stop();
            this.start();
        }
    }

    stop() {
        this.watcher?.close();
    }
}
