import Axios from "axios";
import SpotifyMetaHandler from "../SpotifyMetaHandler.js";
import Track from "../music/Track.js";
import APIResponse from "../response/APIResponse.js";
import { LyricSource, Lyrics } from "./LyricSource.js";
import LyricsManager from "./LyricsManager.js";
import Config, { ConfigTemplate } from "../Config.js";
import Exception from "../response/Exception.js";

export default class SpotifyLyrics implements LyricSource {
    private cachedLyrics: Map<string, Lyrics | null> = new Map();
    private readonly config: ConfigTemplate;

    public constructor() {
        this.config = Config();
        LyricsManager.getInstance().registerSource("spotify", this);
    }

    public async getLyrics(track: Track): Promise<Lyrics> {
        const spotify = SpotifyMetaHandler.getInstance();

        const spotifyTrack = await spotify.convertTrackToSpotify(track);
        if (!spotifyTrack) throw new APIResponse(404, `Spotify alternative to track '${track.trackID}' not found.`);
        const trackID = spotifyTrack.id;

        const existingLyrics = this.cachedLyrics.get(trackID);
        if (existingLyrics) {
            if (!existingLyrics.lyrics.length) {
                throw new APIResponse(404, `Lyrics for track '${track.trackID}' not found`);
            }
            return existingLyrics;
        }

        let data: any;
        try {
            data = (await Axios.get(`https://spotify-lyric-api.herokuapp.com/?trackid=${track}`)).data; // todo: implement this internally so it doesn't depend on some random guy's heroku app
            if (data.error !== false) throw "Spotify Heroku error";
        } catch (e) {
            const lyrics: Lyrics = {
                synced: false,
                provider: "Spotify",
                lyrics: []
            }
            this.cachedLyrics.set(trackID, lyrics);
            setTimeout(() => {
                const newLyrics = this.cachedLyrics.get(trackID);
                if (newLyrics == lyrics) {
                    this.cachedLyrics.delete(trackID);
                }
            }, this.config.lyrics_cache_time * 60_000);
            
            throw new APIResponse(404, `Lyrics for track '${track.trackID}' not found`);
        }
        

        try {
            const lyrics: Lyrics = {
                synced: false,
                provider: "Spotify",
                lyrics: []
            };

            if (data.syncType == "LINE_SYNCED") {
                lyrics.synced = true;
                for (let line of data.lines) {
                    if (typeof line.startTimeMs == "string" && typeof line.words == "string") {
                        lyrics.lyrics.push({
                            time: parseInt(line.startTimeMs) / 1000,
                            words: line.words.replaceAll("♪", " ").trim()
                        });
                    }
                }
            } else {
                for (let line of data.lines) {
                    if (typeof line.words == "string") {
                        lyrics.lyrics.push({
                            words: line.words.replaceAll("♪", " ").trim()
                        })
                    }
                }
            }            

            this.cachedLyrics.set(trackID, lyrics);

            setTimeout(() => {
                const newLyrics = this.cachedLyrics.get(trackID);
                if (newLyrics == lyrics) {
                    this.cachedLyrics.delete(trackID);
                }
            }, this.config.lyrics_cache_time * 60_000);

            return lyrics;
        } catch (e) {
            const lyrics: Lyrics = {
                synced: false,
                provider: "Spotify",
                lyrics: []
            }
            this.cachedLyrics.set(trackID, lyrics);

            setTimeout(() => {
                const newLyrics = this.cachedLyrics.get(trackID);
                if (newLyrics == lyrics) {
                    this.cachedLyrics.delete(trackID);
                }
            }, this.config.lyrics_cache_time * 60_000);

            console.error("Spotify Heroku app returned invalid format!", e, data);
            throw new Exception(`Failed to get lyrics from Spotify for track "${track}" (<- Spotify track ID)`);
        }
    };
}