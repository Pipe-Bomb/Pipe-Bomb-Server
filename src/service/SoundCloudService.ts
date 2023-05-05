import { SoundCloud as SCDL } from "scdl-core";
import { Track as SCDLTrack } from "scdl-core/dist/@types/track.js"
import { Playlist as SCDLPlaylist } from "scdl-core/dist/@types/playlist.js"
import Axios from "axios";

import Exception from "../response/Exception.js";
import Track from "../music/Track.js";
import StreamingService, { SearchOptions, UrlType } from "./StreamingService.js";
import APIResponse from "../response/APIResponse.js";
import StreamInfo from "./StreamInfo.js";
import { concatArrayBuffers, removeDuplicates, removeItems, wait } from "../Utils.js";
import ExternalCollection from "../collection/ExternalCollection.js";

let clientID: string = null;
const BASE_URL = "https://api-v2.soundcloud.com";

async function reloadClientID() {
    await SCDL.connect();
    if (!clientID) {
        console.log("Connected to SoundCloud!");
    }
    const anyReference: any = SCDL;
    clientID = anyReference.clientId;
}

console.log("Connecting to SoundCloud...");
reloadClientID();

setInterval(reloadClientID, 600_000);

export async function getClientID() {
    return new Promise<string>(async resolve => {
        if (clientID) return resolve(clientID);
        while (!clientID) {
            await wait(100);
        }
        resolve(clientID);
    });
}

export default class SoundCloudService extends StreamingService {
    constructor() {
        super("SoundCloud", "sc", {
            tracks: true,
            playlists: true,
            search: true
        });
    }

    public async convertUrl(url: string): Promise<UrlType> { // https://soundcloud.com/skrillex/skrillex-with-bobby-raps-leave-me-like-this?in=eyezahh/sets/dads-birthday
        if (!url.startsWith("soundcloud.com/")) return null;
        
        if (url.includes("?")) url = url.split("?")[0];
        const split = url.split("/");
        split.shift();

        if (split.length == 2 && split[1] != "likes") { // track detected
            try {
                await getClientID();
                const track = await SCDL.tracks.getTrack("https://soundcloud.com/" + split[0] + "/" + split[1]);
                return {
                    type: "track",
                    id: "sc-" + track.id
                }
            } catch {
                return null;
            }
        }
        
        if (split.length == 3 && split[1] == "sets") { // playlist detected
            try {
                await getClientID();
                const playlist = await SCDL.playlists.getPlaylist("https://soundcloud.com/" + split[0] + "/sets/" + split[2]);
                return {
                    type: "playlist",
                    id: "sc-" + playlist.id
                }
            } catch {
                return null;
            }
        }

        return null;
    }

    public async search(query: string, types: SearchOptions[], page?: number): Promise<(Track | ExternalCollection)[]> {
        await getClientID();

        try {
            const results = await SCDL.search({
                query,
                limit: 20,
                offset: (page * 20) || 0,
                filter: "all"
            });
            const out: (Track | ExternalCollection)[] = [];
            results.collection.forEach(trackInfo => {
                let newTrackInfo: any = trackInfo;
                switch (trackInfo.kind) {
                    case "track":
                        if (types.includes("tracks")) {
                            out.push(this.convertJsonToTrack(newTrackInfo));
                        }
                        break;
                    case "playlist":
                        if (types.includes("playlists")) {
                            out.push(this.convertJsonToCollection(newTrackInfo));
                        }
                        break;
                    // todo: add support for artists and albums
                }
            });

            removeDuplicates(out, item => {
                if (item instanceof Track) {
                    return "track " + item.trackID;
                }
                if (item instanceof ExternalCollection) {
                    return item.type + " " + item.collectionID;
                }
            });
            
            return out;
        } catch (e) {
            throw new Exception(e);
        }
    }

    public async getAudio(trackID: string): Promise<StreamInfo> {
        trackID = this.convertTrackIDToLocal(trackID);

        return new Promise(async (resolve, reject) => {
            await getClientID();

            try {
                const trackData = await SCDL.tracks.getTrack("https://api.soundcloud.com/tracks/" + trackID);
                for (let transcoding of trackData.media.transcodings) {
                    if (transcoding.format.protocol != "progressive") continue;

                    const { data } = await Axios.get(transcoding.url + "?client_id=" + clientID);

                    return resolve(new StreamInfo(data.url, "audio/mpeg", 0));
                }
                const initialUrl = trackData.media.transcodings[0].url + "?client_id=" + clientID;

                const { data: urlQuery } = await Axios.get(initialUrl);
                const { data: playlist } = await Axios.get(urlQuery.url);
                const urls: string[] = [];
                playlist.split("\n").forEach((line: string) => {
                    if (line.startsWith("https://")) urls.push(line);
                });

                let completedQueries = 0;

                const chunks: ArrayBuffer[] = Array(urls.length);

                async function runQuery(index: number, url: string) {
                    try {
                        const { data } = await Axios.get(url, {
                            responseType: "arraybuffer"
                        });
                        chunks[index] = data;
                    } finally {
                        if (++completedQueries >= urls.length) {
                            const audio = concatArrayBuffers(chunks);
                            resolve(new StreamInfo(Buffer.from(audio), "audio/mpeg", audio.byteLength));
                        }
                    }
                }

                for (let i = 0; i < urls.length; i++) {
                    runQuery(i, urls[i]);
                }
            } catch (e) {
                // console.error(e);
                reject(new APIResponse(400, `Invalid track ID '${trackID}'`));
            }
        });
    }

    public async getTrack(trackID: string): Promise<Track> {
        await getClientID();
        try {
            const trackInfo = (await SCDL.tracks.getTracksByIds([parseInt(trackID)]))[0];
            return this.convertJsonToTrack(trackInfo);
        } catch (e) {
            console.log("failed to get soundcloud data!");
            throw new Exception(e);
        }
    }

    public convertJsonToTrack(trackInfo: SCDLTrack) {
        return new Track("sc-" + trackInfo.id, {
            title: trackInfo.title,
            artists: [trackInfo.user.username],
            image: trackInfo?.artwork_url || null,
            duration: trackInfo.duration / 1000,
            originalUrl: trackInfo.permalink_url
        });
    }

    public convertJsonToCollection(json: SCDLPlaylist) {
        const tracks: Track[] = [];
        for (let rawTrack of json.tracks) {
            if (rawTrack.permalink) {
                tracks.push(this.convertJsonToTrack(rawTrack));
            } else {
                tracks.push(new Track("sc-" + rawTrack.id));
            }
        }

        let lastModified: number | Date = json.last_modified;
        if (lastModified instanceof Date) {
            lastModified = lastModified.getTime();
        }
        
        return new ExternalCollection("playlist", this, "sc-" + json.id.toString(), json.title, lastModified, tracks, json?.artwork_url);
    }


    public async getSuggestedTracks(track: Track): Promise<Track[]> {
        const trackID = this.convertTrackIDToLocal(track.trackID);

        try {
            const data = await Axios.get(`${BASE_URL}/tracks/${trackID}/related?client_id=${clientID}`);
            if (data.status != 200) throw "status code " + data.status;
            if (!Array.isArray(data.data.collection)) throw "invalid response";

            const out: Track[] = [];

            data.data.collection.forEach(newTrackInfo => {
                out.push(this.convertJsonToTrack(newTrackInfo));
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
        await getClientID();
        try {
            const data = await SCDL.playlists.getPlaylist("https://api.soundcloud.com/playlists/" + playlistID);
            const playlist = this.convertJsonToCollection(data);
            return playlist;
        } catch (e) {
            console.log(e);
            throw new APIResponse(404, `Invalid collection ID '${playlistID}'`);
        }
    }
}