import YTSR from "ytsr";
import YTDL from "ytdl-core";
import Track from "../music/Track.js";
import Exception from "../response/Exception.js";
import StreamingService from "./StreamingService.js";
import APIResponse from "../response/APIRespose.js";
export default class Youtube extends StreamingService {
    constructor() {
        super("Youtube", "yt");
    }
    async search(query, page) {
        try {
            const results = await YTSR(query);
            const out = [];
            results.items.forEach(data => {
                if (data.type == "video") {
                    out.push(new Track(`yt-${data.id}`, {
                        title: data.title,
                        artists: [data.author.name],
                        image: data.thumbnails[0].url
                    }));
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
            return new Track(`yt-${trackID}`, {
                title: data.videoDetails.title,
                artists: [data.videoDetails.author.name],
                image: thumbnail
            });
        }
        catch (e) {
            throw new Exception(e);
        }
    }
}
//# sourceMappingURL=Youtube.js.map