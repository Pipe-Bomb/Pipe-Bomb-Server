import Track from "../music/Track.js";
import APIResponse from "../response/APIRespose.js";
import Exception from "../response/Exception.js";
import Config from "../Config.js";
class ServiceManager {
    constructor() {
        this.services = new Map();
        this.trackCache = new Map();
        console.log("Created service manager");
    }
    static getInstance() {
        if (!this.instance)
            this.instance = new ServiceManager();
        return this.instance;
    }
    registerService(name, service) {
        if (this.services.has(name))
            throw new Exception(`Cannot register service! Name '${name}' is taken.`);
        this.services.set(name, service);
        console.log(`Registered service '${name}'!`);
    }
    getService(name) {
        if (!name)
            throw new APIResponse(400, `Service not specified`);
        const service = this.services.get(name);
        if (!service)
            throw new APIResponse(400, `Service '${name}' does not exist`);
        return service;
    }
    getServiceList() {
        return Array.from(this.services.keys());
    }
    async getTrackInfo(trackID) {
        if (trackID instanceof Track)
            trackID = trackID.trackID;
        if (trackID.split("-").length != 2)
            throw new APIResponse(400, `'${trackID}' is not a valid track ID`);
        const cachedTrack = this.trackCache.get(trackID);
        if (cachedTrack)
            return cachedTrack;
        const prefix = trackID.split("-")[0];
        for (let service of this.services.values()) {
            if (service.prefix != prefix)
                continue;
            const track = await service.getTrack(service.convertTrackIDToLocal(trackID));
            this.trackCache.set(track.trackID, track);
            setTimeout(() => {
                this.trackCache.delete(track.trackID);
            }, ServiceManager.timeout * 60000);
            return track;
        }
        throw new APIResponse(400, `'${trackID}' is not a valid track ID`);
    }
    getServiceFromTrackID(trackID) {
        if (trackID instanceof Track)
            trackID = trackID.trackID;
        if (trackID.split("-").length < 2)
            throw new APIResponse(400, `Invalid track ID '${trackID}'`);
        const prefix = trackID.split("-")[0];
        for (let service of this.services.values()) {
            if (service.prefix == prefix)
                return service;
        }
        throw new APIResponse(400, `Invalid track ID '${trackID}'`);
    }
}
ServiceManager.timeout = Config().track_cache_time;
ServiceManager.instance = null;
export default ServiceManager;
//# sourceMappingURL=ServiceManager.js.map