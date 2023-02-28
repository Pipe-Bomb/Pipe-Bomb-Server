import Track from "../music/Track.js";
import APIResponse from "../response/APIRespose.js";
import Exception from "../response/Exception.js";
import StreamingService from "./StreamingService.js";
import Config from "../Config.js";

export default class ServiceManager {
    private static readonly timeout = Config().track_cache_time;
    private static instance: ServiceManager = null;

    private services: Map<string, StreamingService> = new Map();
    private trackCache: Map<string, Track> = new Map();

    private constructor() {
        console.log("Created service manager");
    }

    public static getInstance(): ServiceManager {
        if (!this.instance) this.instance = new ServiceManager();
        return this.instance;
    }

    public registerService(name: string, service: StreamingService) {
        if (this.services.has(name)) throw new Exception(`Cannot register service! Name '${name}' is taken.`);
        this.services.set(name, service);
        console.log(`Registered service '${name}'!`);
    }

    public getService(name: string): StreamingService {
        if (!name) throw new APIResponse(400, `Service not specified`);
        const service = this.services.get(name);
        if (!service) throw new APIResponse(400, `Service '${name}' does not exist`);
        return service;
    }

    public getServiceList(): string[] {
        return Array.from(this.services.keys());
    }

    public async getTrackInfo(trackID: Track | string): Promise<Track> {
        if (trackID instanceof Track) trackID = trackID.trackID;
        if (trackID.split("-").length != 2) throw new APIResponse(400, `'${trackID}' is not a valid track ID`);
        const cachedTrack = this.trackCache.get(trackID);
        if (cachedTrack) return cachedTrack;
        const prefix = trackID.split("-")[0];
        for (let service of this.services.values()) {
            if (service.prefix != prefix) continue;
            const track = await service.getTrack(service.convertTrackIDToLocal(trackID));
            this.trackCache.set(track.trackID, track);
            setTimeout(() => {
                this.trackCache.delete(track.trackID);
            }, ServiceManager.timeout * 60_000);
            return track;
        }
        return null;
    }

    public getServiceFromTrackID(trackID: Track | string): StreamingService {
        if (trackID instanceof Track) trackID = trackID.trackID;
        if (trackID.split("-").length != 2) throw new APIResponse(400, `Invalid track ID '${trackID}'`);
        const prefix = trackID.split("-")[0];
        for (let service of this.services.values()) {
            if (service.prefix == prefix) return service;
        }
        throw new APIResponse(400, `Invalid track ID '${trackID}'`);
    }
}