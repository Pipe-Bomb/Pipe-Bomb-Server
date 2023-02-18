export default class Track {
    constructor(trackID, metadata) {
        this.trackID = trackID;
        this.metadata = metadata || null;
    }
    isUnknown() {
        return this.metadata == null;
    }
}
//# sourceMappingURL=Track.js.map