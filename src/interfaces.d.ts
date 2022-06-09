export interface iPreprocessor {
    processFile: (filePath:string) => Promise<string>;
}
