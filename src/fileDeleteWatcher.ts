export class FileDeleteWatcher {
    private filePath: string;
    private watcher: Deno.FsWatcher | null = null;

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    async watch() {
        this.watcher = Deno.watchFs(this.filePath);
        for await (const event of this.watcher) {
            if (event.kind === "remove") break;
        }
        this.watcher = null;
        return this.filePath;
    }

    stop() {
        this.watcher?.close();
        this.watcher = null;
    }
}
