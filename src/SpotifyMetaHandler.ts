import SpotifyWebApi from "spotify-web-api-node";
import { convertArrayToString, wait } from "./Utils.js";
import Config, { ConfigTemplate } from "./Config.js";
import Track from "./music/Track.js";
import Exception from "./response/Exception.js";
import APIResponse from "./response/APIResponse.js";
import ServiceManager from "./service/ServiceManager.js";

export default class SpotifyMetaHandler {
    private static instance: SpotifyMetaHandler;

    private spotify: SpotifyWebApi = null;
    private authenticated = false;
    private disabled = false;
    private readonly config: ConfigTemplate;
    private cachedConversions: Map<string, SpotifyApi.TrackObjectFull> = new Map();

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
            this.disabled = true;
            return;
        }

        this.spotify = new SpotifyWebApi({
            clientId: this.config.spotify_client_id,
            clientSecret: this.config.spotify_client_secret
        });

        this.getAccessToken();
    }

    public isDisabled() {
        return this.disabled;
    }

    private async waitForAuth() {
        return new Promise<void>(async (resolve, reject) => {
            if (this.disabled) {
                return reject(new APIResponse(503, "Spotify related features are not available on this Pipe Bomb server."));
            }
            while (!this.authenticated) {
                await wait(100);
            }
            resolve();
        });
    }

    public async getApi() {
        await this.waitForAuth();
        return this.spotify;
    }

    private async getAccessToken() {
        return new Promise<void>(resolve => {
            if (!this.authenticated) console.log("Connecting to Spotify...");
            this.spotify.clientCredentialsGrant().then(data => {
                if (!this.authenticated) console.log("Connected to Spotify!");

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
            const results = await this.spotify.searchTracks(query, {
                limit: 30
            });
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

    public async getPlaylistTracklist(playlistID: string) {
        try {
            let offset = 0;
            const trackQueries: (() => Promise<Track>)[] = [];
            while (1) {
                const tracklist = await this.spotify.getPlaylistTracks(playlistID, {
                    limit: 100,
                    offset
                });
                offset += 100;
                for (let track of tracklist.body.items) {
                    if (!track.track) continue;
                    const artists = track.track.artists.map(artist => artist.name);
                    const query = convertArrayToString(artists) + " - " + track.track.name
                    trackQueries.push(async () => {
                        const track = await ServiceManager.getInstance().convertNamesToTracks("Youtube Music", query);
                        return track[0].track;
                    });
                }
                if (!tracklist.body.next) break;
            }
            
            return trackQueries;
        } catch (e) {
            throw new Exception(`Failed to get tracklist for Spotify playlist ${playlistID}`);
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
}