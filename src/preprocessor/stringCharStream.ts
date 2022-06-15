export class StringCharStream {
    private input: string;

    private lin = 0;

    private pos = 0;

    private col = 0;

    constructor(input: string) {
        this.input = input;
    }

    get position(): number {
        return this.pos;
    }

    get line(): number {
        return this.lin;
    }

    get column(): number {
        return this.col;
    }

    public next(): string {
        const char = this.peek();
        this.pos++;
        if (char == "\n") {
            this.lin++;
            this.col = 0;
        } else {
            this.col++;
        }
        return char;
    }

    public readWhileTrue(check: (char: string) => boolean): string {
        let out = "";
        while (!this.eof() && check(this.peek())) {
            out += this.next();
        }
        return out;
    }

    public readQuoted(quote = '"', escape = "\\"): string {
        let escaped = false;
        const check = function (char: string) {
            if (char == quote && !escaped) return false;
            if (char == escape && !escaped) escaped = true;
            else escaped = false;
            return true;
        };
        return this.readWhileTrue(check);
    }

    public readToEnd() {
        return this.readWhileTrue(_c => true);
    }

    public peek(count = 0): string {
        return this.input.charAt(this.pos + count);
    }

    public eof() {
        return this.peek() == "";
    }

    public croak(error: string) {
        return new Error(`[${this.line}:${this.col}] - ${error}`);
    }

    public rewindTo(position: number) {
        this.rewind();
        while (this.pos < position) {
            this.next();
        }
    }

    public rewind() {
        this.pos = 0;
        this.lin = 0;
        this.col = 0;
    }
}
