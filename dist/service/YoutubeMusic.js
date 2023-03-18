import * as YTM from "node-youtube-music";
import YTDL from "ytdl-core";
import Exception from "../response/Exception.js";
import Track from "../music/Track.js";
import StreamingService from "./StreamingService.js";
import APIResponse from "../response/APIRespose.js";
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
    async getAudio(trackID) {
        trackID = this.convertTrackIDToLocal(trackID);
        try {
            const stream = YTDL("https://www.youtube.com/watch?v=" + trackID, {
                filter: "audioonly",
                highWaterMark: 1 << 16
            });
            return stream;
        }
        catch (e) {
            throw new APIResponse(400, `Invalid track ID '${trackID}'`);
        }
    }
    async getTrack(trackID) {
        trackID = this.convertTrackIDToLocal(trackID);
        try {
            const data = await YTDL.getInfo("https://www.youtube.com/watch?v=" + trackID);
            let thumbnail = data.thumbnail_url || null;
            if (!thumbnail && data.videoDetails.thumbnails.length) {
                thumbnail = data.videoDetails.thumbnails[0].url;
            }
            return new Track(`ym-${trackID}`, {
                title: data.videoDetails.title,
                artists: [data.videoDetails.author.name],
                image: thumbnail
            });
        }
        catch (e) {
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