import FS from "fs";
import { generateSlug } from "random-word-slugs";

console.log("Loading config...");

export interface ConfigTemplate {
    server_port: number,
    server_name: string,
    collection_cache_time: number,
    user_cache_time: number,
    track_cache_time: number,
    audio_cache_time: number,
    lyrics_cache_time: number,
    spotify_track_conversion_cache_time: number,
    spotify_client_id: string,
    spotify_client_secret: string,
    lyrics_source_hierarchy: string[]
}

const defaultConfig: ConfigTemplate = {
    server_port: 8000,
    server_name: generateSlug(2, {
        format: "title",
        partsOfSpeech: ["adjective", "adjective"]
    }) + " Pipe Bomb",
    collection_cache_time: 60,
    user_cache_time: 60,
    track_cache_time: 60,
    audio_cache_time: 60,
    spotify_track_conversion_cache_time: 60,
    lyrics_cache_time: 60,
    spotify_client_id: "",
    spotify_client_secret: "",
    lyrics_source_hierarchy: ["deezer", "spotify"]
}

let Config: ConfigTemplate;

if (FS.existsSync("./Config.json")) {
    Config = JSON.parse(FS.readFileSync("./Config.json").toString());
    console.log("Loaded config file");

    let error = false;
    let needsUpdating = false;

    for (let key of Object.keys(defaultConfig)) {
        if (!Object.keys(Config).includes(key)) {
            console.log(`Config file is missing property "${key}", inserting default value of "`, defaultConfig[key], `"`);
            needsUpdating = true;
            Config[key] = defaultConfig[key];
        } else if (typeof Config[key] != typeof defaultConfig[key]) {
            console.log(`Config file's property "${key}" is of invalid type "${typeof Config[key]}". Delete this line from your config file or replace the value with the appropriate type (${typeof defaultConfig[key]}). Default value is "`, defaultConfig[key], `"`);
            error = true;
        }
    }

    if (needsUpdating) {
        FS.writeFileSync("./Config.json", JSON.stringify(Config, null, 2));
    }

    if (error) {
        process.exit(0);
    }

    console.log("Config file is valid");
} else {
    Config = defaultConfig;
    FS.writeFileSync("./Config.json", JSON.stringify(defaultConfig, null, 2));
    console.log("Created new config file");
}


export default function get() {
    return Object.assign({}, Config);
}