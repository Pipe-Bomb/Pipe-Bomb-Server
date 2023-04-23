import * as YTM from "node-youtube-music";
import YTA from "youtube-music-api";
import Track from "../music/Track.js";
import StreamingService from "./StreamingService.js";
import ServiceManager from "./ServiceManager.js";
import Exception from "../response/Exception.js";
import { wait } from "../Utils.js";
import APIResponse from "../response/APIRespose.js";
const Yta = new YTA();
let initialized = false;
Yta.initalize().then(() => {
    initialized = true;
});
export async function waitForInitialization() {
    return new Promise(async (resolve) => {
        if (initialized)
            return resolve();
        while (!initialized) {
            await wait(100);
        }
        resolve();
    });
}
export default class YoutubeMusic extends StreamingService {
    constructor() {
        super("Youtube Music", "ym");
    }
    async search(query, page) {
        try {
            const results = await YTM.searchMusics(query);
            const out = [];
            results.forEach(data => {
                const artists = [];
                data.artists.forEach(artist => {
                    artists.push(artist.name);
                });
                out.push(new Track(`ym-${data.youtubeId}`, {
                    title: data.title,
                    artists,
                    image: data.thumbnailUrl || null
                }));
            });
            return out;
        }
        catch (e) {
            throw new Exception(e);
        }
    }
    getAudio(trackID) {
        trackID = this.convertTrackIDToLocal(trackID);
        return ServiceManager.getInstance().getService("Youtube").getAudio(trackID);
    }
    async getTrack(trackID) {
        await waitForInitialization();
        trackID = this.convertTrackIDToLocal(trackID);
        try {
            const data = await Yta.getSong(trackID);
            if (Array.isArray(data.videoId)) {
                throw new APIResponse(400, `Invalid track ID 'ym-${trackID}'`);
            }
            let thumbnailSize = 0;
            let thumbnail = null;
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
                image: thumbnail
            });
        }
        catch (e) {
            if (e instanceof APIResponse) {
                throw e;
            }
            console.log("YTA ERROR", e);
            throw new Exception(e);
        }
    }
    async getSuggestedTracks(track) {
        const trackID = this.convertTrackIDToLocal(track.trackID);
        try {
            const results = await YTM.getSuggestions(trackID);
            const out = [];
            results.forEach(data => {
                const artists = [];
                data.artists.forEach(artist => {
                    artists.push(artist.name);
                });
                out.push(new Track(`ym-${data.youtubeId}`, {
                    title: data.title,
                    artists,
                    image: data.thumbnailUrl || null
                }));
            });
            return out;
        }
        catch (e) {
            throw new Exception(e);
        }
    }
}
//# sourceMappingURL=YoutubeMusic.js.map