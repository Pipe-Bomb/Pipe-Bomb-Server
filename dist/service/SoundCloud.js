import { SoundCloud as SCDL } from "scdl-core";
import Exception from "../response/Exception.js";
import Track from "../music/Track.js";
import StreamingService from "./StreamingService.js";
import APIResponse from "../response/APIRespose.js";
let isConnected = false;
(async () => {
    console.log("Connecting to SoundCloud...");
    await SCDL.connect();
    console.log("Connected to SoundCloud!");
    isConnected = true;
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
                            image: newTrackInfo?.artwork_url || newTrackInfo?.user?.avatar_url
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
            const stream = await SCDL.download("https://api.soundcloud.com/tracks/" + trackID, {
                highWaterMark: 1 << 16
            });
            return stream;
        }
        catch (e) {
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
                image: trackInfo?.artwork_url || trackInfo?.user?.avatar_url
            });
        }
        catch (e) {
            throw new Exception(e);
        }
    }
    isReady() {
        return isConnected;
    }
}
//# sourceMappingURL=SoundCloud.js.map