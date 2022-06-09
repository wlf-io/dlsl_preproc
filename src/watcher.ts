import type {Config} from "./config/config.ts";

export class Watcher{
    private filePath:string;
    private watcher:Deno.FsWatcher|null = null;

    private timeout:number|null = null;

    private hooks:(()=>void)[] = [];

    constructor(config:Config){
        this.filePath = config.instance.filePath;
    }

    private callHooks(){
        if(this.timeout){
            window.clearTimeout(this.timeout);
        } else {
            console.log("Save detected...");
        }
        this.timeout = window.setTimeout(()=>{
            this.timeout = null;
            this.hooks.forEach(h => h());
        },2000);
    }

    async start(){
        this.watcher = Deno.watchFs(this.filePath);
        for await(const event of this.watcher){
            if(event.kind == "modify"){
                this.callHooks();
            }
        }
    }

    public hook(cb:()=>void){
        this.hooks.push(cb);
    }

    stop(){
        this.watcher?.close();
    }
}
