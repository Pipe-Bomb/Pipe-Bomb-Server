import SpotifyWebApi from "spotify-web-api-node";
import { convertArrayToString, wait } from "./Utils.js";
import Config from "./Config.js";
import Track from "./music/Track.js";
import Exception from "./response/Exception.js";
import Axios from "axios";
import APIResponse from "./response/APIRespose.js";
export default class SpotifyMetaHandler {
    static getInstance() {
        if (this.instance)
            return this.instance;
        this.instance = new SpotifyMetaHandler();
        return this.instance;
    }
    constructor() {
        this.spotify = null;
        this.authenticated = false;
        this.cachedConversions = new Map();
        this.cachedLyrics = new Map();
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
    async waitForAuth() {
        return new Promise(async (resolve) => {
            while (!this.authenticated) {
                await wait(100);
            }
            resolve();
        });
    }
    async getAccessToken() {
        return new Promise(resolve => {
            if (!this.authenticated)
                console.log("Connecting to Spotify...");
            this.spotify.clientCredentialsGrant().then(data => {
                if (!this.authenticated)
                    console.log("Connected to Spotify");
                this.spotify.setAccessToken(data.body.access_token);
                this.authenticated = true;
                setTimeout(() => this.getAccessToken(), (data.body.expires_in - 60) * 1000);
                resolve();
            });
        });
    }
    async searchTracks(track) {
        let query;
        try {
            if (track instanceof Track) {
                query = track.metadata.title + " - " + convertArrayToString(track.metadata.artists);
            }
            else {
                query = track;
            }
            await this.waitForAuth();
            const results = await this.spotify.searchTracks(query);
            return results.body.tracks.items;
        }
        catch (e) {
            if (track instanceof Track) {
                throw new Exception(`Failed to search Spotify for track "${track.trackID}" (${query})`);
            }
            else {
                throw new Exception(`Failed to search Spotify for query "${track}"`);
            }
        }
    }
    async convertTrackToSpotify(track) {
        const existingConversion = this.cachedConversions.get(track.trackID);
        if (existingConversion !== undefined)
            return existingConversion;
        const results = await this.searchTracks(track);
        for (let spotifyTrack of results) {
            if (Math.abs(spotifyTrack.duration_ms / 1000 - track.metadata.duration) < 2) { // tracks are within 2 seconds duration of each other, assume they're the same track
                this.cachedConversions.set(track.trackID, spotifyTrack);
                setTimeout(() => {
                    const newTrack = this.cachedConversions.get(track.trackID);
                    if (newTrack == spotifyTrack) {
                        this.cachedConversions.delete(track.trackID);
                    }
                }, this.config.spotify_track_conversion_cache_time * 60000);
                return spotifyTrack;
            }
        }
        this.cachedConversions.set(track.trackID, null);
        setTimeout(() => {
            const newTrack = this.cachedConversions.get(track.trackID);
            if (!newTrack) {
                this.cachedConversions.delete(track.trackID);
            }
        }, this.config.spotify_track_conversion_cache_time * 60000);
        return null;
    }
    async getLyrics(track) {
        const originalTrack = track;
        if (track instanceof Track) {
            const spotifyTrack = await this.convertTrackToSpotify(track);
            if (!spotifyTrack)
                throw new APIResponse(404, `Spotify alternative to track '${track.trackID}' not found.`);
            track = spotifyTrack.id;
        }
        const existingLyrics = this.cachedLyrics.get(track);
        if (existingLyrics) {
            if (!existingLyrics.length) {
                if (originalTrack instanceof Track) {
                    throw new APIResponse(404, `Lyrics for track '${originalTrack.trackID}' not found`);
                }
                else {
                    throw new APIResponse(404, `Lyrics for track '${originalTrack}' (Spotify ID) not found`);
                }
            }
            return Array.from(existingLyrics);
        }
        let data;
        try {
            data = (await Axios.get(`https://spotify-lyric-api.herokuapp.com/?trackid=${track}`)).data; // todo: implement this internally so it doesn't depend on some random guy's heroku app
            if (data.error !== false || data.syncType != "LINE_SYNCED")
                throw "Spotify Heroku error";
        }
        catch (e) {
            const spotifyTrackId = track;
            const lyrics = [];
            this.cachedLyrics.set(track, lyrics);
            setTimeout(() => {
                const newLyrics = this.cachedLyrics.get(spotifyTrackId);
                if (newLyrics == lyrics) {
                    this.cachedLyrics.delete(spotifyTrackId);
                }
            }, this.config.lyrics_cache_time * 60000);
            if (originalTrack instanceof Track) {
                throw new APIResponse(404, `Lyrics for track '${originalTrack.trackID}' not found`);
            }
            else {
                throw new APIResponse(404, `Lyrics for track '${originalTrack}' (Spotify ID) not found`);
            }
        }
        try {
            const lyrics = [];
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
            }, this.config.lyrics_cache_time * 60000);
            return Array.from(lyrics);
        }
        catch (e) {
            const spotifyTrackId = track;
            const lyrics = [];
            this.cachedLyrics.set(track, lyrics);
            setTimeout(() => {
                const newLyrics = this.cachedLyrics.get(spotifyTrackId);
                if (newLyrics == lyrics) {
                    this.cachedLyrics.delete(spotifyTrackId);
                }
            }, this.config.lyrics_cache_time * 60000);
            console.error("Spotify Heroku app returned invalid format!", e, data);
            throw new Exception(`Failed to get lyrics from Spotify for track "${track}" (<- Spotify track ID)`);
        }
    }
}
//# sourceMappingURL=SpotifyMetaHandler.js.map