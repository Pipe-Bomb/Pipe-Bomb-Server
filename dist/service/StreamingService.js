import ServiceManager from "./ServiceManager.js";
export default class StreamingService {
    constructor(name, prefix) {
        this.name = name;
        this.prefix = prefix;
        ServiceManager.getInstance().registerService(this.name, this);
    }
    convertTrackIDToLocal(trackID) {
        if (trackID.startsWith(this.prefix + "-"))
            return trackID.substring(this.prefix.length + 1);
        return trackID;
    }
}
//# sourceMappingURL=StreamingService.js.map