import type {ConfPreprocessorOverride} from "./config/defaultConfig.ts";
import type {iPreprocessor} from "./interfaces.d.ts";

export class ExternalPreprocessor implements iPreprocessor {
    private config : ConfPreprocessorOverride;

    constructor(config:ConfPreprocessorOverride) {
        this.config = config;
    }
    
    async processFile(filePath: string) : Promise<string> {
        const p = Deno.run({
            cmd: [this.config.path, ... this.config.args, filePath]
        });
        const s = await p.status();
        if (s.success) return "";
        else throw "External Preproc Failed";
    }
}
