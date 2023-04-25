interface TrackMeta {
    readonly artists: string[],
    readonly title: string,
    readonly image?: string,
    readonly duration: number,
    readonly originalUrl: string
}

export default class Track {
    public readonly type: "track";
    public readonly trackID: string;
    public readonly metadata?: TrackMeta;

    constructor(trackID: string, metadata?: TrackMeta) {
        this.trackID = trackID;
        this.metadata = metadata || null;
    }

    public isUnknown() {
        return this.metadata == null;
    }
}