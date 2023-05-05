import ExternalCollection from "../collection/ExternalCollection.js";
import Track from "../music/Track.js";
import ServiceManager from "./ServiceManager.js";
import StreamInfo from "./StreamInfo.js";

export interface StreamingServiceFeatures {
    tracks: boolean,
    playlists: boolean
}

export interface UrlType {
    type: "track" | "playlist",
    id: string
}

export type SearchOptions = "tracks" | "playlists" | "albums";

export default abstract class StreamingService {
    public readonly name: string;
    public readonly prefix: string;
    private features: StreamingServiceFeatures;

    constructor(name: string, prefix: string, features: StreamingServiceFeatures) {
        this.name = name;
        this.prefix = prefix;
        this.features = features;

        ServiceManager.getInstance().registerService(this.name, this);
    }

    public abstract search(query: string, types: SearchOptions[], page?: number): Promise<(Track | ExternalCollection)[]>;
    public abstract getAudio(trackID: string): Promise<StreamInfo>;
    public abstract getTrack(trackID: string): Promise<Track>;
    public abstract getSuggestedTracks(track: Track): Promise<Track[]>;
    public abstract getPlaylist(playlistID: string): Promise<ExternalCollection>;
    public abstract convertUrl(url: string): Promise<UrlType | null>;

    public getFeatures() {
        return Object.assign({}, this.features);
    }

    public convertTrackIDToLocal(trackID: string) {
        if (trackID.startsWith(this.prefix + "-")) return trackID.substring(this.prefix.length + 1);
        return trackID;
    }
}