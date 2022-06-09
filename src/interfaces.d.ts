export interface iPreprocessor {
    processFile: (filePath:string) => Promise<string>;
    getUsedFiles: () => string[];
}
