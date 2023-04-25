import Track from "../music/Track.js";
import APIResponse from "../response/APIRespose.js";
import Exception from "../response/Exception.js";
import Config from "../Config.js";
import PartialContentInfo from "../restapi/PartialContentInfo.js";
import Axios from "axios";
import Pmx from "pmx";
const probe = Pmx.probe();
const config = Config();
const trackInfoLookups = probe.meter({
    name: "Track info lookups in last minute",
    samples: 60
});
const successfulAudioLookups = probe.meter({
    name: "Successful audio lookups in last minute",
    samples: 60
});
const failedAudioLookups = probe.meter({
    name: "Failed audio lookups in last minute",
    samples: 60
});
class ServiceManager {
    constructor() {
        this.services = new Map();
        this.trackCache = new Map();
        this.streamCache = new Map();
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
    getTrackFromCache(trackID) {
        return this.trackCache.get(trackID) || null;
    }
    async getTrackInfo(trackID) {
        if (trackID instanceof Track)
            trackID = trackID.trackID;
        if (trackID.split("-").length < 2)
            throw new APIResponse(400, `'${trackID}' is not a valid track ID`);
        const cachedTrack = this.trackCache.get(trackID);
        if (cachedTrack)
            return cachedTrack;
        const prefix = trackID.split("-")[0];
        for (let service of this.services.values()) {
            if (service.prefix != prefix)
                continue;
            let track;
            trackInfoLookups.mark();
            track = await service.getTrack(service.convertTrackIDToLocal(trackID));
            this.trackCache.set(track.trackID, track);
            setTimeout(() => {
                this.trackCache.delete(track.trackID);
            }, ServiceManager.timeout * 60000);
            return track;
        }
        throw new APIResponse(400, `'${trackID}' is not a valid track ID`);
    }
    getAudio(trackID) {
        return new Promise(async (resolve, reject) => {
            const newTrackID = trackID instanceof Track ? trackID.trackID : trackID;
            if (!newTrackID)
                return reject(new APIResponse(400, `'${trackID}' is not a valid track ID`));
            try {
                const service = this.getServiceFromTrackID(trackID);
                const cachedInfo = this.streamCache.get(newTrackID);
                if (cachedInfo)
                    return resolve(cachedInfo);
                const audio = await service.getAudio(newTrackID);
                audio.setCallback(() => {
                    this.streamCache.delete(newTrackID);
                });
                this.streamCache.set(newTrackID, audio);
                setTimeout(() => {
                    const oldAudio = this.streamCache.get(newTrackID);
                    if (oldAudio == audio) {
                        this.streamCache.delete(newTrackID);
                    }
                }, config.audio_cache_time * 60000);
                successfulAudioLookups.mark();
                resolve(audio);
            }
            catch (e) {
                if (e instanceof APIResponse)
                    return reject(e);
                failedAudioLookups.mark();
                reject(new Exception(e));
            }
        });
    }
    getServiceFromTrackID(trackID) {
        if (trackID instanceof Track)
            trackID = trackID.trackID;
        if (!trackID.includes("-"))
            throw new APIResponse(400, `Invalid track ID '${trackID}'`);
        const prefix = trackID.split("-")[0];
        for (let service of this.services.values()) {
            if (service.prefix == prefix)
                return service;
        }
        throw new APIResponse(400, `Invalid track ID '${trackID}'`);
    }
    convertNamesToTracks(serviceName, ...trackNames) {
        return new Promise((resolve, reject) => {
            const service = this.getService(serviceName);
            if (!service)
                return reject(new Exception(`'${serviceName}' is not a valid streaming service!`));
            const totalSize = trackNames.length;
            let completedSearches = 0;
            const tracks = trackNames.map(track => {
                return {
                    query: track,
                    track: null
                };
            });
            function lookup(index, trackName) {
                trackInfoLookups.mark();
                service.search(trackName)
                    .then(results => {
                    tracks[index].track = results[0] || null;
                    tracks.push();
                }).finally(() => {
                    if (++completedSearches < totalSize) {
                        const newIndex = totalSize - trackNames.length;
                        const newName = trackNames.shift();
                        if (newName) {
                            lookup(newIndex, newName);
                        }
                    }
                    else {
                        resolve(tracks);
                    }
                });
            }
            for (let i = 0; i < 20; i++) { // 20 concurrent lookup threads
                const name = trackNames.shift();
                if (!name)
                    break;
                lookup(i, name);
            }
        });
    }
    async getAudioInfoOnce(trackID, range) {
        const audio = await ServiceManager.getInstance().getAudio(trackID);
        if (audio.content instanceof Buffer) {
            return new APIResponse(200, new PartialContentInfo(audio.content, 0, audio.contentLength - 1, audio.contentLength, audio.contentType));
        }
        if (!audio.contentLength && typeof audio.content == "string") {
            const { headers } = await Axios.head(audio.content, {
                timeout: 3000
            });
            audio.contentLength = parseInt(headers["content-length"]);
        }
        const size = audio.contentLength;
        let start = 0;
        let end = size - 1;
        if (range) {
            let split = range.replace(/bytes=/, "").split("-");
            start = parseInt(split[0], 10);
            end = split[1] ? parseInt(split[1], 10) : size - 1;
            if (!isNaN(start) && isNaN(end)) {
                end = size - 1;
            }
            if (isNaN(start) && !isNaN(end)) {
                start = size - end;
                end = size - 1;
            }
            if (start >= size || end >= size) {
                return new APIResponse(416, size);
            }
        }
        try {
            const { data } = await Axios.get(audio.content, {
                responseType: "stream",
                headers: {
                    Range: `bytes=${start}-${end}`,
                },
                timeout: 5000
            });
            return new APIResponse(206, new PartialContentInfo(data, start, end, size, audio.contentType));
        }
        catch (e) {
            return new APIResponse(503, "Refused by service");
        }
    }
    async getAudioInfo(trackID, range) {
        for (let i = 0; i < 3; i++) {
            try {
                const audio = await this.getAudioInfoOnce(trackID, range);
                if (audio)
                    return audio;
            }
            catch (e) {
                console.log("error on track", trackID);
                if (e instanceof APIResponse) {
                    console.log("error code:", e.statusCode, e.statusMessage);
                    if (e.statusCode != 503) {
                        return e;
                    }
                    else {
                        console.log("error code 503 detected!");
                    }
                }
                else {
                    console.error("Unknown error getting audio!", e);
                }
            }
            console.log("couldn't get audio! trying again (" + (i + 1) + ")");
            this.streamCache.delete(trackID);
        }
        console.log("Giving up on finding track", trackID);
        return new APIResponse(503, "Refused by service");
    }
}
ServiceManager.timeout = Config().track_cache_time;
ServiceManager.instance = null;
export default ServiceManager;
//# sourceMappingURL=ServiceManager.js.map