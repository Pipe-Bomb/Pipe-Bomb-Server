import { removeDuplicates } from "../Utils.js";
import APIResponse from "../response/APIResponse.js";
import ServiceManager from "./ServiceManager.js";
import StreamingService from "./StreamingService.js";
import Axios from "axios";
export default class AZLyrics extends StreamingService {
    constructor() {
        super("AZLyrics", "az");
    }
    async search(query, page) {
        try {
            const { data } = await Axios.get(`https://search.azlyrics.com/suggest.php?q=${encodeURIComponent(query)}&x=71eef200fd95acba541eb752c51aa98edbf44ea340f9ea934383c0006d5b465f`);
            const responses = [];
            for (let track of data.songs) {
                if (!responses.includes(track.autocomplete))
                    responses.push(track.autocomplete);
            }
            for (let lyrics of data.lyrics) {
                if (!responses.includes(lyrics.autocomplete))
                    responses.push(lyrics.autocomplete);
            }
            const tracks = (await ServiceManager.getInstance().convertNamesToTracks("Youtube Music", ...responses)).map(wrapper => wrapper.track);
            removeDuplicates(tracks, track => track.trackID);
            return tracks;
        }
        catch (e) {
            console.error(e);
        }
        return [];
    }
    getAudio(trackID) {
        throw new APIResponse(400, `Invalid track ID '${trackID}'`);
    }
    async getTrack(trackID) {
        throw new APIResponse(400, `Invalid track ID '${trackID}'`);
    }
    async getSuggestedTracks(track) {
        return [];
    }
}
//# sourceMappingURL=AZLyrics.js.map