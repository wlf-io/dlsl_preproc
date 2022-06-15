# dlsl_preproc
A pre processor for LSL written in typescript using [Deno](https://deno.land)

This was mostly a Proof of Concept that has gotten a little out of hand. And thus is poorly implemented IMO, and needs reworking.

It is currenlty designed to be used with firestorm by setting the executable as your external editor

Then configuring your own editor in the config file `<user home>/.deno_lsl_preproc.json`

To build this yourself you need:
 - [Deno](https://deno.land) installed
 - clone this repo
 - `make` installed (optional)
 - run `make build-linux` or `make build-win`

If you do not have `make` installed you can run the deno compile command directly, (it can be found in the makefile).

Vaguely this project needs splitting into two parts, the preprocessor and the firestorm compatability layer.

# Features

 - COMMANDS!!! (obviously, see the list below)
 - String interpolation
 - Run on changes to any files in the include tree
 - Handles multiple scripts being open
 - command passthrough
 - Let dlsl_preproc only handle file watching and dealing with firestorm, and overide the actual preprocessing to anything you want.


## Currently suported commands

 - #include
 - #define
 - #undef (#undefine)
 - #ifdef
 - #ifndef
 - #if
 - #else
 - #endif (#fi)
 - #warning
 - #error
 - #increment
 - #decremrent
 - #goto
 - #label (#tag)
 - #ifgoto
 - #config

Commands can be multiplined using a trailing `\`

## Planned Commands
 - #elif (#elseif)

# String Interpolation

Prefixing a string with the `@` symbol will allow the string to be interpolated.

```c
integer a = 1;
llOwnerSay(@"The variable a is ${a}");
```

Will be converted to

```c
integer a = 1;
llOwnerSay((string)["The variable a is ", a]);
```

# Command Passthrough

This allows for commands to be passed through to the firestorm preprocessor if desired

This is done by using the configured command prefix (defaults to : `#f_`)

```c
#define foo bar   // This define would be handled by the dlsl preprocessor
#f_define foo bar   // This would be converted to #define foo bar and passed into output for another preprocessor (firestorm)
```


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
#include "//global_defines.lsl" //Would include the file found at <lsl_inludes.dir>/global_defines.lsl
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

To help with this though the preprocessor does also include an integrity feature. Allowing you to check a file once and be aware if it changes (bar carefully crafted hash coliding files)

```c
#include "https://example.test/script.lsl" 7dad138a707ebcce44f659efc04add18ee66db47
// Will get the resource and then hash it using sha1
// If the match fails, the preprocessor will stop and throw an error to inform you.
// If an invlaid string is provided for the hash it will also error
```

Integrity checks also work on local files, but that's probably less important

Includes with integrity strings will also be cached in the derectory specified in the config. Or in a folders called `cache`, next to the binary. So you could use a hash to fix a particular version of a file.


## #define

Used to define variables for `#ifdef` `#ifndef` checks and to replace items in code.

```c
#define BOB "bob" // defines the var BOB and sets it to '"BOB"'
```

This does not currently support the function like defininf of the firestorm preprocessor

## #undef (#undefine)

Allows you to unset a defined variable
```c
#undef BOB  //Clears the variable bob if it was set
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

## #if

Conditional statement to skip over or include code works with `#else` and `#endif`

Supported operators
 - ==
 - !=
 - &gt;
 - &gt;=
 - &lt;
 - &lt;=
 - %
 - !%

```c
#define a 1
#if a == 1
// line to include
#endif
```

Whitespace in a conditional is ignored, i.e all the below are valid
```c
#if a == 1
#if a==1
#if a     ==1
#if a     ==1
```
It currently does not parse quited strings though, so `a == "text"` would error.

Numerical comparisons `>`, `<`, `%` etc will only work if left and right items are numric.

## #warning
Will cause the preprocessor to print the text after the command to the console.

## #error
Will cause the preprocessor to error and print the text after the command to the console.

## #increment #decremrent
Will increment or decrement a numeric define, a second argument can be used to use a value other than 1

```c
#define a 0        // a = 0
#increment a       // a = 1
#decrement a       // a = 0
#increment a 5     // a = 5
#decrement a 10    // a = -5
```

## #goto #label

Can be used to goto a line / label

The following examples would all go to line 1 (and loop infinitley)

```c
1| 
2|#goto 1

1|
2|#define a 1
3|
4|#goto a

1|#label start
2|
3|#goto start
```

## #ifgoto

Same as below but on a single line
```
#if a < 1
#goto label
#endif
```

`#ifgoto` example
```c
#ifgoto a<1 label
```

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
            "path": "This path to the editor you wish to use. (Windows requires an absoloute path for now)",
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
        "cmdPrefix": "",
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
