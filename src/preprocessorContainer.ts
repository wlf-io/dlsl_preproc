import type { InstanceConfig } from "./config/instanceConfig.ts";
import type { iPreprocessor } from "./interfaces.d.ts";
import { sha1String } from "./misc.ts";
import { Watcher } from "./watcher.ts";
import { ExternalPreprocessor } from "./externalPreprocessor.ts";
import { Preprocessor } from "./preprocessor/preprocessor.ts";
import { VERSION } from "./version.ts";

export class PreProcessorContainer {
    private filePath: string;
    private config: InstanceConfig;
    private outputFile: string;
    private preprocessor: iPreprocessor;
    private watcher: Watcher;

    private lastHash = "";

    constructor(config: InstanceConfig, preprocessor: iPreprocessor) {
        this.filePath = config.filePath;
        this.outputFile = config.lslFile;
        this.config = config;
        this.preprocessor = preprocessor;
        this.watcher = new Watcher(config);
        this.watcher.hook(() => {
            this.process();
        });
    }

    async start() {
        await this.dryRun();
        this.watcher.start();
    }

    stop() {
        this.watcher.stop();
    }


    async dryRun() {
        try {
            await this.runPreporcessor();
            this.watcher.addFiles(this.preprocessor.getUsedFiles());
        } catch (e) {
            console.log(e);
        }
    }

    private async runPreporcessor(): Promise<string> {
        try {
            return await this.preprocessor.processFile(this.filePath);
        } catch (e) {
            console.error("Preprocessor failed");
            throw e;
        }
    }

    async process() {
        console.log("Preprocessing...");
        try {
            const content = await this.runPreporcessor();
            this.watcher.addFiles(this.preprocessor.getUsedFiles());
            await this.output(content);
        } catch (e) {
            console.error(e);
        }
    }


    private async output(text: string): Promise<void> {
        try {
            const hashHex = await sha1String(text);
            if (this.lastHash == hashHex) {
                console.log("Output Identicle.")
                return;
            }
            this.lastHash = hashHex;
            const content = [
                `//#dlsl_comment Preprocesset with ${this.version} of dlsl preprocessor`,
                `//#dlsl_dir ${this.config.project}`,
                `//#dlsl_file ${this.config.main}`,
                `//#dlsl_hash ${hashHex}`,
                ``,
                text,
            ].join("\n");

            // console.log(content);

            await Deno.writeTextFile(this.outputFile, content);
            console.log("Complete\n");
        } catch (e) {
            console.error("Write Failed");
            throw e;
        }
    }

    get version(): string {
        return VERSION;
    }

    public static getPreProc(config: InstanceConfig): iPreprocessor {
        if (config.params.preprocessor.override.enabled) {
            return new ExternalPreprocessor(config.params.preprocessor.override);
        } else {
            return new Preprocessor(config);
        }
    }
}
