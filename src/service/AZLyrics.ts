import { removeDuplicates } from "../Utils.js";
import ExternalCollection from "../collection/ExternalCollection.js";
import Track from "../music/Track.js";
import APIResponse from "../response/APIResponse.js";
import Exception from "../response/Exception.js";
import ServiceManager from "./ServiceManager.js";
import StreamInfo from "./StreamInfo.js";
import StreamingService, { SearchOptions, UrlType } from "./StreamingService.js";
import Axios from "axios";

export default class AZLyrics extends StreamingService {
    public constructor() {
        super("AZLyrics", "az", {
            tracks: false,
            playlists: false
        });
    }

    public async convertUrl(url: string): Promise<UrlType> {
        return null;
    }

    public async search(query: string, types: SearchOptions[], page?: number): Promise<Track[]> {
        try {
            const { data } = await Axios.get(`https://search.azlyrics.com/suggest.php?q=${encodeURIComponent(query)}&x=71eef200fd95acba541eb752c51aa98edbf44ea340f9ea934383c0006d5b465f`);

            const responses: string[] = [];
            for (let track of data.songs) {
                if (!responses.includes(track.autocomplete)) responses.push(track.autocomplete);
            }
            for (let lyrics of data.lyrics) {
                if (!responses.includes(lyrics.autocomplete)) responses.push(lyrics.autocomplete);
            }

            const tracks = (await ServiceManager.getInstance().convertNamesToTracks("Youtube Music", ...responses)).map(wrapper => wrapper.track);
            removeDuplicates(tracks, track => track.trackID);

            return tracks;
        } catch (e) {
            console.error(e);
        }
        return [];
    }

    public getAudio(trackID: string): Promise<StreamInfo> {
        throw new APIResponse(400, `Invalid track ID '${trackID}'`);
    }

    public async getTrack(trackID: string): Promise<Track> {
        throw new APIResponse(400, `Invalid track ID '${trackID}'`);
    }

    public async getSuggestedTracks(track: Track): Promise<Track[]> {
        return [];
    }

    public getPlaylist(playlistID: string): Promise<ExternalCollection> {
        throw new Exception("Method not implemented.");
    }
}