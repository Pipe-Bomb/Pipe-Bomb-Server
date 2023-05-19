import YTSR from "ytsr";
import YTDL from "ytdl-core"

import Track from "../music/Track.js";
import Exception from "../response/Exception.js";
import StreamingService, { SearchOptions, UrlType } from "./StreamingService.js";
import APIResponse from "../response/APIResponse.js";
import StreamInfo from "./StreamInfo.js";
import Axios from "axios";
import { getHttpAgent, removeDuplicates, removeItems } from "../Utils.js";
import ExternalCollection from "../collection/ExternalCollection.js";

export default class YoutubeService extends StreamingService {
    constructor() {
        super("Youtube", "yt", {
            tracks: true,
            playlists: false,
            search: true
        });
    }

    public async convertUrl(url: string): Promise<UrlType> {
        if (url.startsWith("youtube.com/watch?v=")) { // track detected
            let id = url.split("=", 2)[1];
            if (id.includes("&")) {
                id = id.split("&")[0];
            }
            return {
                type: "track",
                id: "yt-" + id
            }
        }

        if (url.startsWith("youtu.be/")) { // track detected
            let id = url.split("/")[1];
            if (id.includes("?")) {
                id = id.split("?")[0];
            }
            return {
                type: "track",
                id: "yt-" + id
            }
        }
        return null;
    }

    public async search(query: string, types: SearchOptions[], page?: number): Promise<Track[]> {
        try {
            const results = await YTSR(query);

            const out: Track[] = [];
            
            results.items.forEach(data => {
                if (data.type == "video") {
                    out.push(this.convertJsonToTrack(data));
                }
            });

            removeDuplicates(out, track => track.trackID);
            
            return out;
        } catch (e) {
            throw new Exception(e);
        }
    }

    private forceGetAudio(trackID: string): Promise<StreamInfo> {
        trackID = this.convertTrackIDToLocal(trackID);

        return new Promise<StreamInfo>(async (resolve, reject) => {
            try {
                let info: YTDL.videoInfo;
                try {
                    info = await YTDL.getInfo(trackID);
                    if (!info) throw "invalid";
                } catch (e) {
                    console.log(e);
                    return reject(new APIResponse(400, `Invalid track ID '${trackID}'`));
                }
                
                const audioFormats = YTDL.filterFormats(info.formats, "audioonly");

                const reorderedFormats: YTDL.videoFormat[] = [];
                for (let format of audioFormats) {
                    if (format.audioQuality == "AUDIO_QUALITY_MEDIUM") {
                        const index = audioFormats.indexOf(format);
                        if (index >= 0) audioFormats.splice(index, 1);
                        reorderedFormats.push(format);
                    }
                }
                reorderedFormats.push(...audioFormats);
                
                async function checkFormat(url: string): Promise<StreamInfo> {
                    try {
                        console.log("checking", url);
                        const { headers, status } = await Axios.head(url, {
                            ...getHttpAgent()
                        });
                        console.log(status, headers);
                        if (status == 200) {
                            return new StreamInfo(url, headers["content-type"], headers["content-length"]);
                        }
                    } catch (e) {
                        console.error(e?.cause);
                    }
                    return null;
                }

                for (let format of reorderedFormats) {
                    const streamInfo = await checkFormat(format.url);
                    if (streamInfo) return resolve(streamInfo);
                }
            } catch {}
            reject(new APIResponse(503, `Refused by service`));
        });
    }

    public getAudio(trackID: string): Promise<StreamInfo> {
        trackID = this.convertTrackIDToLocal(trackID);

        return new Promise(async (resolve, reject) => {
            try {
                for (let i = 0; i < 3; i++) { // 3 tries
                    const streamInfo = await this.forceGetAudio(trackID);
                    if (streamInfo) return resolve(streamInfo);
                }
            } catch {
                console.log("failed to get youtube track 3 times!");
                reject(new APIResponse(400, `Invalid track ID '${trackID}'`));
            }
        });
    }

    public async getTrack(trackID: string): Promise<Track> {
        trackID = this.convertTrackIDToLocal(trackID);

        const url = "https://www.youtube.com/watch?v=" + trackID;
        try {
            const data = await YTDL.getInfo(url);

            let thumbnailSize = 0;
            let thumbnail: string | null = null;
            for (let thumbnailData of data.videoDetails.thumbnails) {
                const newSize = thumbnailData.width * thumbnailData.height;
                if (newSize > thumbnailSize) {
                    thumbnailSize = newSize;
                    thumbnail = thumbnailData.url;
                }
            }

            if (!thumbnail && data.videoDetails.thumbnails.length) {
                thumbnail = data.videoDetails.thumbnails[0].url;
            }

            let details: any = data.videoDetails;
            details.id = data.videoDetails.videoId;

            return new Track(`yt-${data.videoDetails.videoId}`, {
                title: data.videoDetails.title,
                artists: [data.videoDetails.author.name],
                image: thumbnail,
                duration: parseFloat(data.videoDetails.lengthSeconds),
                originalUrl: data.videoDetails.video_url
            });
        } catch (e) {
            console.log("YTDL ERROR", url);
            throw new Exception(e);
        }
    }

    public convertJsonToTrack(trackInfo: YTSR.Video) {
        let thumbnailSize = 0;
        let thumbnail: string | null = null;
        for (let thumbnailData of trackInfo.thumbnails) {
            const newSize = thumbnailData.width * thumbnailData.height;
            if (newSize > thumbnailSize) {
                thumbnailSize = newSize;
                thumbnail = thumbnailData.url;
            }
        }

        let duration = 0;
        if (trackInfo.duration) {
            trackInfo.duration.split(":").forEach(value => {
                duration = duration * 60 + parseInt(value);
            });
        }
        

        return new Track(`yt-${trackInfo.id}`, {
            title: trackInfo.title,
            artists: [typeof trackInfo.author == "string" ? trackInfo.author : trackInfo.author.name],
            image: thumbnail,
            duration,
            originalUrl: "https://youtube.com/watch?v=" + trackInfo.id
        });
    }

    public async getSuggestedTracks(track: Track): Promise<Track[]> {
        const trackID = this.convertTrackIDToLocal(track.trackID);
        try {
            const info = await YTDL.getInfo(trackID);
            if (!info) throw "invalid";
            const tracks: Track[] = [];

            for (let trackInfo of info.related_videos) {
                const anyTrack: any = trackInfo;
                tracks.push(this.convertJsonToTrack(anyTrack));
            }

            removeDuplicates(tracks, track => track.trackID);
            removeItems(tracks, newTrack => newTrack.trackID != track.trackID);

            return tracks;
        } catch (e) {
            console.error(e);
            new APIResponse(400, `Invalid track ID '${trackID}'`)
        }
    }


    
    public getPlaylist(playlistID: string): Promise<ExternalCollection> {
        throw new Exception("Method not implemented.");
    }
}