import * as YTM from "node-youtube-music";
import Exception from "../response/Exception.js";
import Track from "../music/Track.js";
import StreamingService from "./StreamingService.js";
import ServiceManager from "./ServiceManager.js";
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
        trackID = this.convertTrackIDToLocal(trackID);
        return ServiceManager.getInstance().getService("Youtube").getTrack(trackID);
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