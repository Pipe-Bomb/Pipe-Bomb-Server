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

    public async search(query: string, page?: number): Promise<Track[]> {
        try {
            const results = await YTM.searchMusics(query);
            const out: Track[] = [];

            results.forEach(data => {
                const artists: string[] = [];
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
        } catch (e) {
            throw new Exception(e);
        }
    }

    public async getAudio(trackID: string): Promise<any> {
        trackID = this.convertTrackIDToLocal(trackID);

        try {
            const stream = YTDL("https://www.youtube.com/watch?v=" + trackID, {
                filter: "audioonly",
                highWaterMark: 1 << 16  
            });
            return stream;
        } catch (e) {
            throw new APIResponse(400, `Invalid track ID '${trackID}'`);
        }
    }

    public async getTrack(trackID: string): Promise<Track> {
        trackID = this.convertTrackIDToLocal(trackID);

        try {
            const data = await YTDL.getInfo("https://www.youtube.com/watch?v=" + trackID);
            return new Track(`ym-${trackID}`, {
                title: data.videoDetails.title,
                artists: [data.videoDetails.author.name],
                image: data.thumbnail_url || null
            });
        } catch (e) {
            throw new Exception(e);
        }
    }
}