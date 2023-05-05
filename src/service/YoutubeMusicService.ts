import * as YTM from "node-youtube-music";
import YTA from "youtube-music-api";

import Track from "../music/Track.js";
import StreamingService, { SearchOptions, UrlType } from "./StreamingService.js";
import ServiceManager from "./ServiceManager.js";
import StreamInfo from "./StreamInfo.js";
import Exception from "../response/Exception.js";
import { removeDuplicates, removeItems, wait } from "../Utils.js";
import APIResponse from "../response/APIResponse.js";
import ExternalCollection from "../collection/ExternalCollection.js";

const Yta = new YTA();

let initialized = false;
Yta.initalize().then(() => {
    initialized = true;
});

export async function waitForInitialization() {
    return new Promise<void>(async resolve => {
        if (initialized) return resolve();
        while (!initialized) {
            await wait(100);
        }
        resolve();
    });
}

export default class YoutubeMusicService extends StreamingService {
    constructor() {
        super("Youtube Music", "ym", {
            tracks: true,
            playlists: true
        });
    }

    public async convertUrl(url: string): Promise<UrlType> {
        if (url.startsWith("music.youtube.com/watch?v=")) { // track detected
            let id = url.split("=", 2)[1];
            if (id.includes("&")) {
                id = id.split("&")[0];
            }
            return {
                type: "track",
                id: "ym-" + id
            }
        }
        if (url.startsWith("music.youtube.com/playlist?list=")) { // playlist detected
            let id = url.split("=", 2)[1];
            if (id.includes("&")) {
                id = url.split("&")[0];
            }
            return {
                type: "playlist",
                id: "ym-" + id
            }
        }
        return null;
    }

    public async search(query: string, types: SearchOptions[], page?: number): Promise<(Track | ExternalCollection)[]> {
        if (!types.length) return [];
        let neededQueries = 0;
        if (types.includes("tracks")) neededQueries++;
        if (types.includes("playlists")) neededQueries++;

        const out: (Track | ExternalCollection)[] = [];
        const link = this;

        return new Promise(resolve => {
            function end() {
                if (--neededQueries <= 0) {
                    removeDuplicates(out, item => {
                        if (item instanceof Track) {
                            return "track " + item.trackID;
                        }
                        if (item instanceof ExternalCollection) {
                            return item.type + " " + item.collectionID;
                        }
                    });
                    resolve(out);
                }
            }
    
            if (types.includes("tracks")) {
                YTM.searchMusics(query)
                .then(tracks => {
                    for (let track of tracks) {
                        if (track.youtubeId) {
                            out.push(this.convertJsonToTrack(track));
                        }
                    }
                }).finally(end);
            }
            
            if (types.includes("playlists")) {
                YTM.searchPlaylists(query)
                .then(playlists => {
                    if (!playlists.length) return end();
                    let playlistsDone = 0;
    
                    async function doPlaylist(playlist: YTM.PlaylistPreview) {
                        try {
                            const tracks = await YTM.listMusicsFromPlaylist(playlist.playlistId);
                            const tracklist = tracks.map(track => link.convertJsonToTrack(track));
                            const collection = new ExternalCollection("playlist", link, "ym-" + playlist.playlistId, playlist.title, Date.now(), tracklist, playlist.thumbnailUrl);
                            out.push(collection);
                        } finally {
                            if (++playlistsDone >= playlists.length) {
                                end();
                            }
                        }
                    }
    
                    for (let playlist of playlists) {
                        doPlaylist(playlist);
                    }
                }).catch(end);
            }
        });
    }

    public getAudio(trackID: string): Promise<StreamInfo> {
        trackID = this.convertTrackIDToLocal(trackID);

        return ServiceManager.getInstance().getService("Youtube").getAudio(trackID);
    }

    public convertJsonToTrack(trackInfo: YTM.MusicVideo) {
        if (!trackInfo.youtubeId) {
            console.log("here", trackInfo.youtubeId);
        }
        
        return new Track(`ym-${trackInfo.youtubeId}`, {
            title: trackInfo.title,
            artists: trackInfo.artists.map(artist => artist.name),
            image: trackInfo.thumbnailUrl,
            duration: trackInfo.duration?.totalSeconds || 0,
            originalUrl: "https://music.youtube.com/watch?v=" + trackInfo.youtubeId
        })
    }

    public async getTrack(trackID: string): Promise<Track> {
        await waitForInitialization();
        trackID = this.convertTrackIDToLocal(trackID);        

        try {
            const data = await Yta.getSong(trackID);

            if (Array.isArray(data.videoId)) {
                throw new APIResponse(400, `Invalid track ID 'ym-${trackID}'`);
            }

            let thumbnailSize = 0;
            let thumbnail: string | null = null;
            for (let thumbnailData of data.thumbnails) {
                const newSize = thumbnailData.width * thumbnailData.height;
                if (newSize > thumbnailSize) {
                    thumbnailSize = newSize;
                    thumbnail = thumbnailData.url;
                }
            }
            
            return new Track(`ym-${trackID}`, {
                title: data.name,
                artists: [data.artist],
                image: thumbnail,
                duration: Math.round(data.duration / 1000),
                originalUrl: data.url
            });
        } catch (e) {
            if (e instanceof APIResponse) {
                throw e;
            }
            console.error("YTA ERROR", e);
            throw new Exception(e);
        }
    }

    public async getSuggestedTracks(track: Track): Promise<Track[]> {
        const trackID = this.convertTrackIDToLocal(track.trackID);

        try {
            const results = await YTM.getSuggestions(trackID);

            const out: Track[] = [];

            results.forEach(data => {
                out.push(this.convertJsonToTrack(data));
            });

            removeDuplicates(out, track => track.trackID);
            removeItems(out, newTrack => newTrack.trackID != track.trackID);

            return out;
        } catch (e) {
            throw new Exception(e);
        }
    }


    public async getPlaylist(playlistID: string): Promise<ExternalCollection> {
        playlistID = this.convertTrackIDToLocal(playlistID);
        await waitForInitialization();
        try {
            const data = await Yta.getPlaylist(playlistID, 5000); // youtube music playlists are a max of 5000 songs

            const tracklist: Track[] = [];
            for (let trackData of data.content) {
                let thumbnailSize = 0;
                let thumbnail: string | null = null;
                if (Array.isArray(trackData.thumbnails)) {
                    for (let thumbnailData of trackData.thumbnails) {
                        const newSize = thumbnailData.width * thumbnailData.height;
                        if (newSize > thumbnailSize) {
                            thumbnailSize = newSize;
                            thumbnail = thumbnailData.url;
                        }
                    }
                } else {
                    thumbnail = trackData.thumbnails?.url || null;
                }
                console.log("2", trackData.videoId);
                tracklist.push(new Track(`ym-${trackData.videoId}`, {
                    title: trackData.name,
                    artists: [trackData.author.name],
                    image: thumbnail,
                    duration: trackData.duration / 1000,
                    originalUrl: "https://music.youtube.com/watch?v=" + trackData.videoId
                }));
            }

            let thumbnailSize = 0;
            let thumbnail: string | null = null;
            for (let thumbnailData of data.thumbnails) {
                const newSize = thumbnailData.width * thumbnailData.height;
                if (newSize > thumbnailSize) {
                    thumbnailSize = newSize;
                    thumbnail = thumbnailData.url;
                }
            }

            const collection = new ExternalCollection("playlist", this, "ym-" + playlistID, data.title, Date.now(), tracklist, thumbnail);
            return collection;
        } catch (e) {
            console.error(e);
            throw new APIResponse(404, `Invalid collection ID '${playlistID}'`);
        }
    }
}