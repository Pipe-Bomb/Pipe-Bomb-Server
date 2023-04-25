import { SoundCloud as SCDL } from "scdl-core";
import Axios from "axios";
import Exception from "../response/Exception.js";
import Track from "../music/Track.js";
import StreamingService from "./StreamingService.js";
import APIResponse from "../response/APIRespose.js";
import StreamInfo from "./StreamInfo.js";
import { concatArrayBuffers, wait } from "../Utils.js";
let isConnected = false;
let clientID = null;
const BASE_URL = "https://api-v2.soundcloud.com";
async function reloadClientID() {
    await SCDL.connect();
    if (!clientID) {
        console.log("Connected to SoundCloud!");
    }
    isConnected = true;
    const anyReference = SCDL;
    clientID = anyReference.clientId;
}
console.log("Connecting to SoundCloud...");
reloadClientID();
setInterval(reloadClientID, 600000);
export async function getClientID() {
    return new Promise(async (resolve) => {
        if (clientID)
            return resolve(clientID);
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
    async search(query, page) {
        await getClientID();
        try {
            const results = await SCDL.search({
                query,
                limit: 20,
                offset: (page * 20) || 0,
                filter: "tracks"
            });
            const out = [];
            results.collection.forEach(trackInfo => {
                let newTrackInfo = trackInfo;
                switch (trackInfo.kind) {
                    case "track":
                        out.push(newTrackInfo);
                        break;
                    // todo: add support for artists and playlists
                }
            });
            return out;
        }
        catch (e) {
            throw new Exception(e);
        }
    }
    async getAudio(trackID) {
        trackID = this.convertTrackIDToLocal(trackID);
        return new Promise(async (resolve, reject) => {
            await getClientID();
            try {
                const trackData = await SCDL.tracks.getTrack("https://api.soundcloud.com/tracks/" + trackID);
                for (let transcoding of trackData.media.transcodings) {
                    if (transcoding.format.protocol != "progressive")
                        continue;
                    const { data } = await Axios.get(transcoding.url + "?client_id=" + clientID);
                    return resolve(new StreamInfo(data.url, "audio/mpeg", 0));
                }
                const initialUrl = trackData.media.transcodings[0].url + "?client_id=" + clientID;
                const { data: urlQuery } = await Axios.get(initialUrl);
                const { data: playlist } = await Axios.get(urlQuery.url);
                const urls = [];
                playlist.split("\n").forEach(line => {
                    if (line.startsWith("https://"))
                        urls.push(line);
                });
                let completedQueries = 0;
                const chunks = Array(urls.length);
                async function runQuery(index, url) {
                    try {
                        const { data } = await Axios.get(url, {
                            responseType: "arraybuffer"
                        });
                        chunks[index] = data;
                    }
                    finally {
                        if (++completedQueries >= urls.length) {
                            const audio = concatArrayBuffers(chunks);
                            resolve(new StreamInfo(Buffer.from(audio), "audio/mpeg", audio.byteLength));
                        }
                    }
                }
                for (let i = 0; i < urls.length; i++) {
                    runQuery(i, urls[i]);
                }
            }
            catch (e) {
                // console.error(e);
                reject(new APIResponse(400, `Invalid track ID '${trackID}'`));
            }
        });
    }
    async getTrack(trackID) {
        await getClientID();
        try {
            const trackInfo = (await SCDL.tracks.getTracksByIds([parseInt(trackID)]))[0];
            return this.convertJsonToTrack(trackInfo);
        }
        catch (e) {
            console.log("failed to get soundcloud data!");
            throw new Exception(e);
        }
    }
    convertJsonToTrack(trackInfo) {
        return new Track("sc-" + trackInfo.id, {
            title: trackInfo.title,
            artists: [trackInfo.user.username],
            image: trackInfo?.artwork_url || null,
            duration: trackInfo.duration / 1000,
            originalUrl: trackInfo.permalink_url
        });
    }
    async getSuggestedTracks(track) {
        const trackID = this.convertTrackIDToLocal(track.trackID);
        try {
            const data = await Axios.get(`${BASE_URL}/tracks/${trackID}/related?client_id=${clientID}`);
            if (data.status != 200)
                throw "status code " + data.status;
            if (!Array.isArray(data.data.collection))
                throw "invalid response";
            const out = [];
            data.data.collection.forEach(newTrackInfo => {
                out.push(this.convertJsonToTrack(newTrackInfo));
            });
            return out;
        }
        catch (e) {
            throw new Exception(e);
        }
    }
}
//# sourceMappingURL=SoundCloud.js.map