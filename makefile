

build-win:
	deno compile --target x86_64-pc-windows-msvc --allow-write --allow-run --allow-read --allow-net --allow-env=HOME,HOMEPATH --output bin/dlsl_preproc.exe src/main.ts

build-linux:
	deno compile --target x86_64-unknown-linux-gnu --allow-write --allow-run --allow-read --allow-net --allow-env=HOME,HOMEPATH --output bin/dlsl_preproc src/main.ts

build: build-win build-linux

install: deps

deps:
	deno install -f deps.ts

