import * as ReadLine from "readline";

const reader = ReadLine.createInterface({
    input: process.stdin
});

const handlers: Map<string, (parameters: string[]) => void> = new Map();

reader.on("line", line => {
    const parts = line.split(" ");
    for (let key of handlers.keys()) {
        const keyParts = key.split(" ");
        if (parts.length < keyParts.length) continue;
        let cancel = false;
        for (let i = 0; i < keyParts.length; i++) {
            if (parts[i] != keyParts[i]) {
                cancel = true;
                break;
            }
        }
        if (!cancel) {
            const handler = handlers.get(key)!;
            handler(parts.slice(keyParts.length));
            return;
        }
    }
});

const Commands = {
    addHandler: (args: string, callback: (parameters: string[]) => void) => {
        if (handlers.has(args)) {
            throw "Command already has handler registered";
        }
        handlers.set(args, callback);
    },
    removeHandler: (args: string) => {
        handlers.delete(args);
    }
}

export default Commands;