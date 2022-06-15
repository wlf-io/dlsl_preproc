const defaultConf: ConfDefault = {
    active: false,
    projectsDir: "",
    projectConfigPath: "",
    port: 3929,
    __comment: {
        projectsDir: "should be a path to where on your system dlsl_preproc should create and look for lsl work by default",
        port: "the port dlsl should use for comunication between it and following instances (this is done to avoid having multiple running when editing utliple scripts), set to 0 to disable (not tested)"
    },
    editor: {
        path: "code",
        args: [
            "-w",
        ],
        __comment: {
            "path": "This path to the editor you wish to use. (Windows requires an absoloute path for now)",
            "path example": "code",
            "args": "Array of arguments for the editor, $path will be replaced with the folder path to open, or if not present it will just be appended",
        },
    },
    lsl_includes: {
        dir: "",
        globalInclude: "",
        __comment: {
            path: "Path to find absolute lsl files to include, this will default to your projectsPath if left empty",
            globalIncludes: "File to include in every compile, useful for clobal constants",
        },
    },
    preprocessor: {
        cmdPrefix: "",
        passThroughPrefix: "f_",
        allowHttpInclude: false,
        httpCacheDir: "",
        allowFSStyleAbsoluteIncludes: false,
        maxGoTo: 1000,
        __comment: {
            cmdPrefix : "A prefix for all preproc commands, e.g. if set to 'd_' then the include command would be #d_include, all non prefixed commands would be passed through to the output",
            passThroughPrefix : "A prefix to explicitly pass through it will be trimmed off, incase you use NO cmdPrefix but want to pass something through, e.g. if set to 'f_' then using #f_include will be passed to the output as #include",
            allowFSStyleAbsoluteIncludes: "Allow includes without '//' at the start to resolve to paths relative to 'lsl_includes.dir' like in firestorm",
            maxGoTo: "The maximum number of times you can goto a specific line (set to 0 to disable)",
        },
        override: {
            enabled: false,
            useStdOut: true,
            path: "",
            args: [],
            __comment: [
                "This section allows using a custom preprocessor",
                "args will be apprented tot the path to run the executable",
                "$input will be replaced with the filepath to be processed",
                "$output will be repalced with the expected output path if stdout is not being used",
            ],
        },
    },
};

export function defaultConfig(): ConfDefault {
    return JSON.parse(JSON.stringify(defaultConf));
}

export type ConfDefault = {
    active: boolean;
    projectsDir: string;
    projectConfigPath: string;
    port: number;
    editor: {
        path: string;
        args: string[];
        __comment?: uComment;
    };
    lsl_includes: {
        dir: string,
        globalInclude: string;
        __comment?: uComment;
    };
    preprocessor: {
        cmdPrefix: string;
        passThroughPrefix: string;
        allowHttpInclude: boolean;
        httpCacheDir: string;
        override: ConfPreprocessorOverride;
        allowFSStyleAbsoluteIncludes: boolean;
        maxGoTo: number;
        __comment?: uComment;
    };
    __comment?: uComment;
}


type uComment = string | Dict<string> | string[];
type Dict<T> = { [k: string]: T };

export type ConfPreprocessorOverride = {
    __comment?: uComment,
    enabled: boolean,
    path: string,
    args: string[],
    useStdOut: boolean;
};
