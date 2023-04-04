import Track from "../music/Track.js";
import APIResponse from "../response/APIRespose.js";
import Exception from "../response/Exception.js";
import StreamingService from "./StreamingService.js";
import Config from "../Config.js";
import StreamInfo from "./StreamInfo.js";

export interface ConversionWrapper {
    query: string,
    track: Track | null
}

export default class ServiceManager {
    private static readonly timeout = Config().track_cache_time;
    private static instance: ServiceManager = null;

    private services: Map<string, StreamingService> = new Map();
    private trackCache: Map<string, Track> = new Map();
    private streamCache: Map<string, StreamInfo> = new Map();

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
        if (trackID.split("-").length < 2) throw new APIResponse(400, `'${trackID}' is not a valid track ID`);
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
        throw new APIResponse(400, `'${trackID}' is not a valid track ID`);
    }

    public getAudio(trackID: Track | string): Promise<StreamInfo> {
        return new Promise(async (resolve, reject) => {
            const newTrackID = trackID instanceof Track ? trackID.trackID : trackID;
            if (!newTrackID) return reject(new APIResponse(400, `'${trackID}' is not a valid track ID`));

            try {
                const service = this.getServiceFromTrackID(trackID);

                const cachedInfo = this.streamCache.get(newTrackID);
                if (cachedInfo) return resolve(cachedInfo);

                const audio = await service.getAudio(newTrackID);
                audio.setCallback(() => {
                    this.streamCache.delete(newTrackID);
                });
                this.streamCache.set(newTrackID, audio);

                resolve(audio);
            } catch (e) {
                if (e instanceof APIResponse) return reject(e);
                reject(new Exception(e));
            }
        });
    }

    public getServiceFromTrackID(trackID: Track | string): StreamingService {
        if (trackID instanceof Track) trackID = trackID.trackID;
        if (!trackID.includes("-")) throw new APIResponse(400, `Invalid track ID '${trackID}'`);
        const prefix = trackID.split("-")[0];
        for (let service of this.services.values()) {
            if (service.prefix == prefix) return service;
        }
        throw new APIResponse(400, `Invalid track ID '${trackID}'`);
    }

    public convertNamesToTracks(serviceName: string, ...trackNames: string[]) {
        return new Promise<ConversionWrapper[]>((resolve, reject) => {
            const service = this.getService(serviceName);
            if (!service) return reject(new Exception(`'${serviceName}' is not a valid streaming service!`));

            const totalSize = trackNames.length;
            let completedSearches = 0;
            const tracks: ConversionWrapper[] = trackNames.map(track => {
                return {
                    query: track,
                    track: null
                }
            });

            function lookup(index: number, trackName: string) {
                service.search(trackName)
                .then(results => {
                    tracks[index].track = results[0] || null;
                    tracks.push()
                }).finally(() => {
                    if (++completedSearches < totalSize) {
                        const newIndex = totalSize - trackNames.length;
                        const newName = trackNames.shift();
                        if (newName) {
                            lookup(newIndex, newName);
                        }
                    } else {
                        resolve(tracks);
                    }
                });
            }

            for (let i = 0; i < 20; i++) { // 20 concurrent lookup threads
                const name = trackNames.shift();
                if (!name) break;
                lookup(i, name);
            }
        });
    }
}