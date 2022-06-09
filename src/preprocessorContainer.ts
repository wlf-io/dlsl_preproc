import type { Config } from "./config/config.ts";
import type { iPreprocessor } from "./interfaces.d.ts";
import {sha256String} from "./misc.ts";

export class PreProcessorContainer {
    private filePath: string;
    private config: Config;
    private outputFile: string;
    private preprocessor: iPreprocessor;

    constructor(config: Config, preprocessor: iPreprocessor) {
        this.filePath = config.instance.filePath;
        this.outputFile = config.instance.lslFile;
        this.config = config;
        this.preprocessor = preprocessor;
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
            const raw = await this.runPreporcessor();
            await this.output(raw);
        } catch (e) {
            console.error(e);
        }
    }

    private async output(raw: string): Promise<void> {
        try {
            const hashHex = sha256String(raw);
            const content = [
                `//#dlsl_dir ${this.config.instance.project}`,
                `//#dlsl_file ${this.config.instance.main}`,
                `//#dlsl_hash ${hashHex}`,
                ``,
                raw,
            ].join("\n");

            console.log(content);

            await Deno.writeTextFile(this.outputFile, content);
        } catch (e) {
            console.error("Write Failed");
            throw e;
        }
    }
}
