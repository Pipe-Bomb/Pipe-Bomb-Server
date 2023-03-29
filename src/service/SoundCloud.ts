import { SoundCloud as SCDL } from "scdl-core";
import Axios from "axios";

import Exception from "../response/Exception.js";
import Track from "../music/Track.js";
import StreamingService from "./StreamingService.js";
import APIResponse from "../response/APIRespose.js";
import StreamInfo from "./StreamInfo.js";

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

    public async getAudio(trackID: string): Promise<StreamInfo | string> {
        trackID = this.convertTrackIDToLocal(trackID);
        if (!this.isReady()) throw new Exception("SoundCloud service hasn't finished initialization.");

        try {
            const stream = await SCDL.download("https://api.soundcloud.com/tracks/" + trackID, {
                highWaterMark: 1 << 16
            });

            return new StreamInfo(stream, "audio/mpeg", 0);
        } catch (e) {
            throw new APIResponse(400, `Invalid track ID '${trackID}'`);
        }
    }

    public async getTrack(trackID: string): Promise<Track> {
        if (!this.isReady()) throw new Exception("SoundCloud service hasn't finished initialization.");
        try {
            const trackInfo = (await SCDL.tracks.getTracksByIds([parseInt(trackID)]))[0];
            return new Track("sc-" + trackInfo.id, {
                title: trackInfo.title,
                artists: [trackInfo.user.username],
                image: trackInfo?.artwork_url || null
            });
        } catch (e) {
            throw new Exception(e);
        }
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