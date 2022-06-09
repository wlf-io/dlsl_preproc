

build:
	deno compile --target x86_64-pc-windows-msvc --allow-write --allow-run --allow-read --allow-env=HOME,HOMEPATH --output bin/lsl_preproc.exe src/main.ts
	deno compile --target x86_64-unknown-linux-gnu --allow-write --allow-run --allow-read --allow-env=HOME,HOMEPATH --output bin/lsl_preproc src/main.ts


deps:
	deno install -f deps.ts

test:
	deno run --allow-write --allow-read --allow-env=HOME,HOMEPATH ./src/main.ts bob
