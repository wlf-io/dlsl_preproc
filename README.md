# dlsl_preproc
A pre processor for LSL written in typescript using deno

This was mostly a Proof of Concept that has gotten a little out of hand. And thus is poorly implemented IMO, and needs reworking.

It is currenlty designed to be used with firestorm by setting the executable as your external editor

Then configuring your own editor in the config file `<user home>/.deno_lsl_preproc.json`


# Currenlty suported commands

 - #include
 - #define *
 - #undef (#undefine)
 - #ifdef
 - #ifndef
 - #else
 - #endif (#fi)
 - #warning
 - #error

* Partial support

Commands can be multiplined using a trailing `\\`

# Planned Commands
 - finish #define support
 - #if
 - #elif (#elseif)

# Commands

## #include

Allows including of files via relative or project/system absolute paths as well as https:// urls

e.g given the following folder structure

```
| - project
  | - main.lsl
  | - second.lsl
  | - lib/
    | - extra.lsl
  | - shared/
    | - shared.lsl
```

When working in `main.lsl`
```c
#include "./second.lsl"  //would include /project/second.lsl
#include "./lib/extra.lsl"  //would include /project/lib/second.lsl
````

When wornign in `shared.lsl`
```c
#include "./second.lsl"  //WOULD FAIL
#include "/second.lsl"  //would include /project/second.lsl
#include "../lib/extra.lsl"  //would include /project/lib/second.lsl
````

A global includes directory can also be set in the config file parameter `lsl_includes.dir` if it is empty the current project path will be used instead.

Global includes can be referenced with `//`
e.g
```c
#include "//global_defines.lsl" //Would include the file found at <lsl_inluders.dir>/global_defines.lsl
```

### Http includes
Currently only secure https urls are supported.

the processor will fetch the file at the url and include it, relative paths in a file included from a url will also be followed.

So if you include `https://example.test/example/test.lsl` and it contains the following
```c
#include "./file2.lsl" //Would include https://example.test/example/file2.lsl
#include "/example/file3.lsl" //Would include https://example.test/example/file3.lsl
#include "../other/other.lsl" //Would include https://example.test/other/other.lsl
```

**Warning**: this can be dangerous if you do not control the resources hosted at the url. You should be sure and check what you are including youself.

To help with this though the preprocessor does also includ an integrity feature.

```c
#include "https://example.test/script.lsl" 7dad138a707ebcce44f659efc04add18ee66db47
// Will get the resource and then hash it using sha1
// If the match fails, the preprocessor will stop and throw an error to inform you.
// If an invlaid string is provided for the hash it will also error
```

Integrity checks also work on local files, but that's probably less important


## #define

**PARTIAL SUPPORT**

Currently define is partially supported you can define things and set a value, but it will not be used for anything other than `#ifdef` and `#ifndef` checks.

Support for defined variabels being inserted into the code is being worked on

```c
#define BOB "bob" // deifns the var BOB and sets it to '"BOB"'
```

## #undef (#undefine)

Allows you to unset a defined variable
```c
#undef BOB  //Clears teh variable bob if it was set
```

## #ifdef - #ifndef - #else

Can be used to conitionally skip sections of a file depending ont eh existance of a defined variable.

```c
#define THING

#ifdef THING
integer thing = TRUE;
#else
integer thing = FALSE;
#endif
```

Statements can be nested

## #warning
Will cause the preprocessor to print the text after the command to the console.

## #error
Will cause the preprocessor to error and print the text after the command to the console.

# Config

```JSON
{
    "active": false,
    "projectsDir": "",
    "projectConfigPath": "",
    "port": 3929,
    "__comment": {
        "active": "If the preproc is active, this starts as false mostly to force the user to open the config and hopefully setup directories",
        "projectsDir": "should be a path to where on your system dlsl_preproc should create and look for lsl work by default",
        "port": "the port dlsl should use for comunication between it and following instances (this is done to avoid having multiple running when editing utliple scripts), set to 0 to disable (not tested)"
    },
    "editor": {
        "path": "code",
        "args": [
            "-w"
        ],
        "__comment": {
            "path": "This should tore the path to the editor you wish to use.",
            "path example": "code",
            "args": "Array of arguments for the editor, $path will be replaced with the folder path to open, or if not present it will just be appended"
        }
    },
    "lsl_includes": {
        "dir": "",
        "globalInclude": "",
        "__comment": {
            "path": "Path to find absolute lsl files to include, this will default to your projectsPath if left empty",
            "globalIncludes": "File to include in every compile, useful for clobal constants"
        }
    },
    "preprocessor": {
        "cmdPrefix": "d_",
        "passThroughPrefix": "f_",
        "allowHttpInclude": false,
        "httpCacheDir": "",
        "allowFSStyleAbsoluteIncludes": false,
        "__comment": {
            "cmdPrefix": "A prefix for all preproc commands, e.g. if set to 'd_' then the include command would be #d_include, all non prefixed commands would be passed through to the output",
            "passThroughPrefix": "A prefix to explicitly pass through it will be trimmed off, incase you use NO cmdPrefix but want to pass something through, e.g. if set to 'f_' then using #f_include will be passed to the output as #include",
            "allowFSStyleAbsoluteIncludes": "Allow includes without '//' at the start to resolve to paths relative to 'lsl_includes.dir' like in firestorm"
        },
        "override": {
            "enabled": false,
            "useStdOut": true,
            "path": "",
            "args": [],
            "__comment": [
                "This section allows using a custom preprocessor",
                "args will be apprented tot the path to run the executable",
                "$input will be replaced with the filepath to be processed",
                "$output will be repalced with the expected output path if stdout is not being used"
            ]
        }
    }
}
```
