import YTSR from "ytsr";
import YTDL from "ytdl-core";
import Track from "../music/Track.js";
import Exception from "../response/Exception.js";
import StreamingService from "./StreamingService.js";
import APIResponse from "../response/APIRespose.js";
import StreamInfo from "./StreamInfo.js";
import Axios from "axios";
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
    forceGetAudio(trackID) {
        trackID = this.convertTrackIDToLocal(trackID);
        return new Promise(async (resolve, reject) => {
            try {
                let info;
                try {
                    info = await YTDL.getInfo(trackID);
                    if (!info)
                        throw "invalid";
                }
                catch (e) {
                    console.log(e);
                    return reject(new APIResponse(400, `Invalid track ID '${trackID}'`));
                }
                const audioFormats = YTDL.filterFormats(info.formats, "audioonly");
                const reorderedFormats = [];
                for (let format of audioFormats) {
                    if (format.audioQuality == "AUDIO_QUALITY_MEDIUM") {
                        const index = audioFormats.indexOf(format);
                        if (index >= 0)
                            audioFormats.splice(index, 1);
                        reorderedFormats.push(format);
                    }
                }
                reorderedFormats.push(...audioFormats);
                async function checkFormat(url) {
                    try {
                        const { headers, status } = await Axios.head(url);
                        if (status == 200) {
                            return new StreamInfo(url, headers["content-type"], headers["content-length"]);
                        }
                    }
                    catch { }
                    return null;
                }
                for (let format of reorderedFormats) {
                    const streamInfo = await checkFormat(format.url);
                    if (streamInfo)
                        return resolve(streamInfo);
                }
            }
            catch { }
            reject(new APIResponse(503, `Refused by service`));
        });
    }
    getAudio(trackID) {
        trackID = this.convertTrackIDToLocal(trackID);
        return new Promise(async (resolve, reject) => {
            try {
                for (let i = 0; i < 3; i++) { // 3 tries
                    const streamInfo = await this.forceGetAudio(trackID);
                    if (streamInfo)
                        return resolve(streamInfo);
                }
            }
            catch {
                console.log("failed to get youtube track 3 times!");
                reject(new APIResponse(400, `Invalid track ID '${trackID}'`));
            }
        });
    }
    async getTrack(trackID) {
        trackID = this.convertTrackIDToLocal(trackID);
        const url = "https://www.youtube.com/watch?v=" + trackID;
        try {
            const data = await YTDL.getInfo(url);
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
            console.log("YTDL ERROR", url);
            throw new Exception(e);
        }
    }
    async getSuggestedTracks(track) {
        return []; // TODO: implement
    }
}
//# sourceMappingURL=Youtube.js.map