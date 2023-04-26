import SpotifyWebApi from "spotify-web-api-node";
import { convertArrayToString, wait } from "./Utils.js";
import Config, { ConfigTemplate } from "./Config.js";
import Track from "./music/Track.js";
import Exception from "./response/Exception.js";
import Axios from "axios";
import APIResponse from "./response/APIRespose.js";

export interface Lyric {
    time: number,
    words: string
}

export default class SpotifyMetaHandler {
    private static instance: SpotifyMetaHandler;

    private spotify: SpotifyWebApi = null;
    private authenticated = false;
    private readonly config: ConfigTemplate;
    private cachedConversions: Map<string, SpotifyApi.TrackObjectFull> = new Map();
    private cachedLyrics: Map<string, Lyric[] | null> = new Map();

    public static getInstance() {
        if (this.instance) return this.instance;
        this.instance = new SpotifyMetaHandler();
        return this.instance;
    }

    private constructor() {
        this.config = Config();

        if (!this.config.spotify_client_id || !this.config.spotify_client_secret) {
            console.log("Spotify credentials not provided, lyrics won't be available.");
            console.log("Create a Spotify application to get the required credentials https://developer.spotify.com/dashboard");
            return;
        }

        this.spotify = new SpotifyWebApi({
            clientId: this.config.spotify_client_id,
            clientSecret: this.config.spotify_client_secret
        });

        this.getAccessToken();
    }

    private async waitForAuth() {
        return new Promise<void>(async (resolve, reject) => {
            if (!this.config.spotify_client_id || !this.config.spotify_client_secret) {
                reject(new APIResponse(503, "Spotify related features are not available on this Pipe Bomb server."));
            }
            while (!this.authenticated) {
                await wait(100);
            }
            resolve();
        });
    }

    private async getAccessToken() {
        return new Promise<void>(resolve => {
            if (!this.authenticated) console.log("Connecting to Spotify...");
            this.spotify.clientCredentialsGrant().then(data => {
                if (!this.authenticated) console.log("Connected to Spotify");

                this.spotify.setAccessToken(data.body.access_token);
                this.authenticated = true;

                setTimeout(() => this.getAccessToken(), (data.body.expires_in - 60) * 1000);
                resolve();
            });
        });
    }

    public async searchTracks(track: Track | string) {
        let query: string;
        try {
            if (track instanceof Track) {
                query = track.metadata.title + " - " + convertArrayToString(track.metadata.artists);
            } else {
                query = track;
            }
            await this.waitForAuth();
            const results = await this.spotify.searchTracks(query);
            return results.body.tracks.items;
        } catch (e) {
            if (e instanceof APIResponse) throw e;
            if (track instanceof Track) {
                throw new Exception(`Failed to search Spotify for track "${track.trackID}" (${query})`);
            } else {
                throw new Exception(`Failed to search Spotify for query "${track}"`);
            }
        }   
    }

    public async convertTrackToSpotify(track: Track) {
        const existingConversion = this.cachedConversions.get(track.trackID);
        if (existingConversion !== undefined) return existingConversion;

        const results = await this.searchTracks(track);

        for (let spotifyTrack of results) {
            if (Math.abs(spotifyTrack.duration_ms / 1000 - track.metadata.duration) < 2) { // tracks are within 2 seconds duration of each other, assume they're the same track
                this.cachedConversions.set(track.trackID, spotifyTrack);
                setTimeout(() => {
                    const newTrack = this.cachedConversions.get(track.trackID);
                    if (newTrack == spotifyTrack) {
                        this.cachedConversions.delete(track.trackID);
                    }
                }, this.config.spotify_track_conversion_cache_time * 60_000);
                return spotifyTrack;
            }
        }

        this.cachedConversions.set(track.trackID, null);
        setTimeout(() => {
            const newTrack = this.cachedConversions.get(track.trackID);
            if (!newTrack) {
                this.cachedConversions.delete(track.trackID);
            }
        }, this.config.spotify_track_conversion_cache_time * 60_000);

        return null;
    }

    public async getLyrics(track: Track | string) {
        const originalTrack = track;
        if (track instanceof Track) {
            const spotifyTrack = await this.convertTrackToSpotify(track);
            if (!spotifyTrack) throw new APIResponse(404, `Spotify alternative to track '${track.trackID}' not found.`);
            track = spotifyTrack.id;
        }

        const existingLyrics = this.cachedLyrics.get(track);
        if (existingLyrics) {
            if (!existingLyrics.length) {
                if (originalTrack instanceof Track) {
                    throw new APIResponse(404, `Lyrics for track '${originalTrack.trackID}' not found`);
                } else {
                    throw new APIResponse(404, `Lyrics for track '${originalTrack}' (Spotify ID) not found`);
                }
            }
            return Array.from(existingLyrics);
        }

        let data: any;
        try {
            data = (await Axios.get(`https://spotify-lyric-api.herokuapp.com/?trackid=${track}`)).data; // todo: implement this internally so it doesn't depend on some random guy's heroku app
            if (data.error !== false || data.syncType != "LINE_SYNCED") throw "Spotify Heroku error";
        } catch (e) {
            const spotifyTrackId = track;
            const lyrics: Lyric[] = [];
            this.cachedLyrics.set(track, lyrics);
            setTimeout(() => {
                const newLyrics = this.cachedLyrics.get(spotifyTrackId);
                if (newLyrics == lyrics) {
                    this.cachedLyrics.delete(spotifyTrackId);
                }
            }, this.config.lyrics_cache_time * 60_000);
            
            if (originalTrack instanceof Track) {
                throw new APIResponse(404, `Lyrics for track '${originalTrack.trackID}' not found`);
            } else {
                throw new APIResponse(404, `Lyrics for track '${originalTrack}' (Spotify ID) not found`);
            }
            
        }
        

        try {
            const lyrics: Lyric[] = [];

            for (let line of data.lines) {
                if (typeof line.startTimeMs == "string" && typeof line.words == "string") {
                    lyrics.push({
                        time: parseInt(line.startTimeMs) / 1000,
                        words: line.words.replaceAll("♪", " ").trim()
                    });
                }
            }

            const spotifyTrackId = track;
            this.cachedLyrics.set(track, lyrics);

            setTimeout(() => {
                const newLyrics = this.cachedLyrics.get(spotifyTrackId);
                if (newLyrics == lyrics) {
                    this.cachedLyrics.delete(spotifyTrackId);
                }
            }, this.config.lyrics_cache_time * 60_000);

            return Array.from(lyrics);
        } catch (e) {
            const spotifyTrackId = track;
            const lyrics: Lyric[] = [];
            this.cachedLyrics.set(track, lyrics);

            setTimeout(() => {
                const newLyrics = this.cachedLyrics.get(spotifyTrackId);
                if (newLyrics == lyrics) {
                    this.cachedLyrics.delete(spotifyTrackId);
                }
            }, this.config.lyrics_cache_time * 60_000);

            console.error("Spotify Heroku app returned invalid format!", e, data);
            throw new Exception(`Failed to get lyrics from Spotify for track "${track}" (<- Spotify track ID)`);
        }
    }
}