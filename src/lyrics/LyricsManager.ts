import Track from "../music/Track.js";
import { LyricSource, Lyrics } from "./LyricSource.js";
import Config, { ConfigTemplate } from "../Config.js";
import APIResponse from "../response/APIResponse.js";

export default class LyricsManager {
    private static instance: LyricsManager;

    private config: ConfigTemplate;
    private sources: Map<string, LyricSource> = new Map();
    private cachedLyrics: Map<string, Lyrics | null> = new Map();

    public static getInstance() {
        if (!this.instance) this.instance = new LyricsManager();
        return this.instance;
    }

    private constructor() {
        console.log("Created lyrics manager");
        this.config = Config();
    }

    public registerSource(sourceID: string, source: LyricSource) {
        if (this.sources.has(sourceID)) return console.error(`Tried to register lyric source "${sourceID}" but it already exists!`);
        this.sources.set(sourceID, source);
        console.log(`Registered lyric source '${sourceID}'`);
    }

    public getSource(sourceID: string) {
        return this.sources.get(sourceID) || null;
    }

    public getLyrics(track: Track) {
        return new Promise<Lyrics>((resolve, reject) => {
            const existingLyrics = this.cachedLyrics.get(track.trackID);
            if (existingLyrics) {
                if (!existingLyrics.lyrics.length) return reject(new APIResponse(404, `Lyrics for track '${track.trackID}' not found`));
                return resolve(existingLyrics);
            }

            let ended = false;

            interface SourceState {
                sourceID: string
                state: "pending" | "failed" | "synced" | "unsynced"
                lyrics: Lyrics | null
            }

            let awaitingSources: SourceState[] = [];

            const cache = this.cachedLyrics;
            const config = this.config;
            function saveLyrics(lyrics?: Lyrics) {
                if (!lyrics) {
                    lyrics = {
                        synced: false,
                        provider: "none",
                        lyrics: []
                    };
                }

                for (let lyric of lyrics.lyrics) {
                    if (lyric.time) {
                        lyric.time = Math.round(lyric.time * 1000) / 1000;
                    }
                }

                cache.set(track.trackID, lyrics);

                setTimeout(() => {
                    const newLyrics = cache.get(track.trackID);
                    if (newLyrics == lyrics) {
                        cache.delete(track.trackID);
                    }
                }, config.lyrics_cache_time * 60_000);
            }

            function checkSources() {
                if (ended) return;

                let awaitingSource: SourceState = null;
                let earliestUnsynced: SourceState = null;
                for (let source of awaitingSources) {
                    if (awaitingSource) return;

                    switch (source.state) {
                        case "synced":
                            ended = true;
                            saveLyrics(source.lyrics);
                            resolve(source.lyrics);
                            return;
                        case "unsynced":
                            if (!earliestUnsynced) earliestUnsynced = source;
                            break;
                        case "pending":
                            awaitingSource = source;
                            break;
                    }
                }
                if (!awaitingSource) {
                    ended = true;
                    if (earliestUnsynced) {
                        saveLyrics(earliestUnsynced.lyrics);
                        resolve(earliestUnsynced.lyrics);
                        return;
                    }

                    saveLyrics()
                    reject(new APIResponse(404, `Lyrics for track '${track.trackID}' not found`));
                }
            }

            for (let i = 0; i < this.config.lyrics_source_hierarchy.length; i++) {
                const service = this.getSource(this.config.lyrics_source_hierarchy[i]);
                if (!service) continue;

                const state: SourceState = {
                    sourceID: this.config.lyrics_source_hierarchy[i],
                    state: "pending",
                    lyrics: null
                };
                awaitingSources.push(state);

                service.getLyrics(track).then(lyrics => {
                    state.state = lyrics.synced ? "synced" : "unsynced";
                    state.lyrics = lyrics;
                }).catch(() => {
                    state.state = "failed";
                    checkSources();
                }).finally(checkSources);
            }

            if (!awaitingSources.length) {
                saveLyrics();
                reject(new APIResponse(503, `No lyrics sources are enabled.`));
            }
        });
    }
}