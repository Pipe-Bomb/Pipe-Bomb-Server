import FS from "fs";
import { generateSlug } from "random-word-slugs";
console.log("Loading config...");
let Config;
if (FS.existsSync("./Config.json")) {
    Config = JSON.parse(FS.readFileSync("./Config.json").toString());
    console.log("Loaded config");
}
else {
    const adjectives = generateSlug(2, {
        format: "title",
        partsOfSpeech: ["adjective", "adjective"]
    });
    const defaultConfig = {
        server_port: 8000,
        server_name: adjectives + " Pipe Bomb",
        collection_cache_time: 60,
        user_cache_time: 60,
        track_cache_time: 60
    };
    Config = defaultConfig;
    FS.writeFileSync("./Config.json", JSON.stringify(defaultConfig, null, 2));
    console.log("Created new config");
}
export default function get() {
    return Object.assign({}, Config);
}
//# sourceMappingURL=Config.js.map