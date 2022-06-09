const defaultConf = {
    active: false,
    __comment: "Projects path should be a path to where on your system dlsl_preproc should create and look for lsl work by default",
    projectsPath: "",
    projectConfigPath: "",
    port: 3929,
    editor: {
        __comment: {
            "path": "This should tore the path to the editor you wish to use.",
            "path example": "code",
            "args": "Array of arguments for the editor, $path will be replaced with the folder path to open, or if not present it will just be appended",
        },
        path: "code",
        args: [
            "-w",
        ],
    },
    lsl_includes: {
        __comment: {
            path: "Path to find absolute lsl files to include, this will default to your projectsPath if left empty",
            globalIncludes: "File to include in every compile, useful for clobal constants",
        },
        path: "",
        globalInclude: "",
    },
    preprocessor: {
        __comment: {
            cmdPrefix : "A prefix for all preproc commands, e.g. if set to 'd_' then the include command would be #d_include, all non prefixed commands would be passed through to the output",
            passThroughPrefix : "A prefix to explicitly pass through it will be trimmed off, incase you use NO cmdPrefix but want to pass something through, e.g. if set to 'f_' then using #f_include will be passed to the output as #include",
        },
        cmdPrefix:  "d_",
        passThroughPrefix: "f_",
        allowHttpInclude: false,
        override: {
            __comment: "This section allows using a custom preprocessor",
            enabled: false,
            useStdOut: true,
            path: "",
            args: [],
            __comment_args: [
                "Args to be provided to the preprocessor",
                "$input will be replaced with the filepath to be processed",
                "$output will be repalced with the expected output path if stdout is not being used",
            ],
        },
    },
} as const;

export function defaultConfig(): ConfDefault {
    return JSON.parse(JSON.stringify(defaultConf));
}

export type ConfDefault = {
    active: boolean;
    projectsPath: string;
    projectConfigPath: string;
    port: number;
    editor: {
        path: string;
        args: string[];
    };
    lsl_includes: {
        path: string,
        globalInclude: string;
    };
    preprocessor: {
        cmdPrefix: string;
        passThroughPrefix: string;
        allowHttpInclude: boolean;
        override: ConfPreprocessorOverride;
    };
}

export type ConfPreprocessorOverride = {
    enabled: boolean,
    path: string,
    args: string[],
};
