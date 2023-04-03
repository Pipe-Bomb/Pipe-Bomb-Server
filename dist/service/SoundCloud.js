import { SoundCloud as SCDL } from "scdl-core";
import Axios from "axios";
import Exception from "../response/Exception.js";
import Track from "../music/Track.js";
import StreamingService from "./StreamingService.js";
import APIResponse from "../response/APIRespose.js";
import StreamInfo from "./StreamInfo.js";
let isConnected = false;
let clientID = null;
const BASE_URL = "https://api-v2.soundcloud.com";
(async () => {
    console.log("Connecting to SoundCloud...");
    await SCDL.connect();
    console.log("Connected to SoundCloud!");
    isConnected = true;
    const anyReference = SCDL;
    clientID = anyReference.clientId;
})();
export default class SoundCloud extends StreamingService {
    constructor() {
        super("SoundCloud", "sc");
    }
    async search(query, page) {
        if (!this.isReady())
            return [];
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
        }
        catch (e) {
            throw new Exception(e);
        }
    }
    async getAudio(trackID) {
        trackID = this.convertTrackIDToLocal(trackID);
        if (!this.isReady())
            throw new Exception("SoundCloud service hasn't finished initialization.");
        try {
            const trackData = await SCDL.tracks.getTrack("https://api.soundcloud.com/tracks/" + trackID);
            for (let transcoding of trackData.media.transcodings) {
                if (transcoding.format.protocol != "progressive")
                    continue;
                const { data } = await Axios.get(transcoding.url + "?client_id=" + clientID);
                return new StreamInfo(data.url, "audio/mpeg", 0);
            }
            throw "fail";
        }
        catch (e) {
            console.error(e);
            throw new APIResponse(400, `Invalid track ID '${trackID}'`);
        }
    }
    async getTrack(trackID) {
        if (!this.isReady())
            throw new Exception("SoundCloud service hasn't finished initialization.");
        try {
            const trackInfo = (await SCDL.tracks.getTracksByIds([parseInt(trackID)]))[0];
            return new Track("sc-" + trackInfo.id, {
                title: trackInfo.title,
                artists: [trackInfo.user.username],
                image: trackInfo?.artwork_url || null
            });
        }
        catch (e) {
            throw new Exception(e);
        }
    }
    isReady() {
        return isConnected;
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
                out.push(new Track(`sc-${newTrackInfo.id}`, {
                    title: newTrackInfo.title,
                    artists: [newTrackInfo.user.username],
                    image: newTrackInfo?.artwork_url || null
                }));
            });
            return out;
        }
        catch (e) {
            throw new Exception(e);
        }
    }
}
//# sourceMappingURL=SoundCloud.js.map