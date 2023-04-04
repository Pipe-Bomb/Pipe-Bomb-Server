import { SoundCloud as SCDL } from "scdl-core";
import Axios from "axios";

import Exception from "../response/Exception.js";
import Track from "../music/Track.js";
import StreamingService from "./StreamingService.js";
import APIResponse from "../response/APIRespose.js";
import StreamInfo from "./StreamInfo.js";
import { concatArrayBuffers, wait } from "../Utils.js";

let isConnected = false;
let clientID: string = null;
const BASE_URL = "https://api-v2.soundcloud.com";

(async () => {
    console.log("Connecting to SoundCloud...");
    await SCDL.connect();
    console.log("Connected to SoundCloud!");
    isConnected = true;
    const anyReference: any = SCDL;
    clientID = anyReference.clientId;
})();

export async function getClientID() {
    return new Promise<string>(async resolve => {
        if (clientID) return resolve(clientID);
        while (!clientID) {
            await wait(100);
        }
        resolve(clientID);
    });
}

export default class SoundCloud extends StreamingService {
    constructor() {
        super("SoundCloud", "sc");
    }

    public async search(query: string, page?: number): Promise<Track[]> {
        if (!this.isReady()) return [];

        try {
            const results = await SCDL.search({
                query,
                limit: 20,
                offset: (page * 20) || 0,
                filter: "tracks"
            });
            const out: Track[] = [];
            results.collection.forEach(trackInfo => {
                let newTrackInfo: any = trackInfo;
                switch (trackInfo.kind) {
                    case "track":
                        out.push(new Track(`sc-${newTrackInfo.id}`, {
                            title: newTrackInfo.title,
                            artists: [newTrackInfo.user.username],
                            image: newTrackInfo?.artwork_url || null
                        }));
                        break;
                    // todo: add support for artists and playlists
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
            if (!this.isReady()) return reject(new Exception("SoundCloud service hasn't finished initialization."));

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
                playlist.split("\n").forEach(line => {
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
        if (!this.isReady()) throw new Exception("SoundCloud service hasn't finished initialization.");
        try {
            const trackInfo = (await SCDL.tracks.getTracksByIds([parseInt(trackID)]))[0];
            return this.convertJsonToTrack(trackInfo);
        } catch (e) {
            throw new Exception(e);
        }
    }

    public convertJsonToTrack(trackInfo: any) {
        return new Track("sc-" + trackInfo.id, {
            title: trackInfo.title,
            artists: [trackInfo.user.username],
            image: trackInfo?.artwork_url || null
        });
    }
    
    private isReady(): boolean {
        return isConnected;
    }

    public async getSuggestedTracks(track: Track): Promise<Track[]> {
        const trackID = this.convertTrackIDToLocal(track.trackID);

        try {
            const data = await Axios.get(`${BASE_URL}/tracks/${trackID}/related?client_id=${clientID}`);
            if (data.status != 200) throw "status code " + data.status;
            if (!Array.isArray(data.data.collection)) throw "invalid response";

            const out: Track[] = [];

            data.data.collection.forEach(newTrackInfo => {
                out.push(new Track(`sc-${newTrackInfo.id}`, {
                    title: newTrackInfo.title,
                    artists: [newTrackInfo.user.username],
                    image: newTrackInfo?.artwork_url || null
                }));
            })
            return out;
        } catch (e) {
            throw new Exception(e);
        }
    }
}