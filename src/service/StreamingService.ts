import Track from "../music/Track.js";
import ServiceManager from "./ServiceManager.js";
import StreamInfo from "./StreamInfo.js";

export default abstract class StreamingService {
    public readonly name: string;
    public readonly prefix: string;

    constructor(name: string, prefix: string) {
        this.name = name;
        this.prefix = prefix;

        ServiceManager.getInstance().registerService(this.name, this);
    }

    public abstract search(query: string, page?: number): Promise<Track[]>;
    public abstract getAudio(trackID: string): Promise<StreamInfo>;
    public abstract getTrack(trackID: string): Promise<Track>;
    public abstract getSuggestedTracks(track: Track): Promise<Track[]>;

    public convertTrackIDToLocal(trackID: string) {
        if (trackID.startsWith(this.prefix + "-")) return trackID.substring(this.prefix.length + 1);
        return trackID;
    }
}