import Track from "../music/Track.js";
import APIResponse from "../response/APIRespose.js";
import ServiceManager from "../service/ServiceManager.js";
import Config from "../Config.js";
import { shuffle } from "../Utils.js";
class Collection {
    constructor(collectionID, name, database, trackList, clearCallback, owner) {
        this.trackList = [];
        this.suggestedTracks = [];
        this.suggestedTracksUpdate = null;
        this.timer = null;
        this.collectionID = collectionID;
        this.name = name;
        this.database = database;
        this.trackList = trackList;
        this.owner = owner || null;
        this.clearCallback = clearCallback;
        this.resetCacheTimeout();
    }
    async loadPage(page) {
        const pageSize = 10;
        for (let i = page * pageSize; i < (page + 1) * pageSize; i++) {
            let track = this.trackList[i];
            if (!track)
                break;
            if (!track.isUnknown())
                continue;
            try {
                const newTrack = await ServiceManager.getInstance().getTrackInfo(track.trackID);
                this.trackList[i] = newTrack;
            }
            catch (e) {
                console.log(`Failed to get track info for item '${i}' in playlist: '${track.trackID}'`, e);
            }
        }
        return this;
    }
    async addTrack(track) {
        if (typeof track == "string") {
            track = await ServiceManager.getInstance().getTrackInfo(track);
        }
        for (let existingTrack of this.trackList) {
            if (existingTrack.trackID == track.trackID)
                throw new APIResponse(409, `Track '${track.trackID}' is already in collection`);
        }
        this.trackList.push(track);
        await this.database.runCommand(`INSERT INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)`, [this.collectionID, track.trackID]);
    }
    async removeTrack(track) {
        if (track instanceof Track)
            track = track.trackID;
        let index = -1;
        for (let i = 0; i < this.trackList.length; i++) {
            if (this.trackList[i].trackID == track) {
                index = i;
                break;
            }
        }
        if (index == -1)
            throw new APIResponse(409, `Track ${track} isn't in collection`);
        this.trackList.splice(index, 1);
        await this.database.runCommand(`DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?`, [this.collectionID, track]);
    }
    async setName(name) {
        this.name = name;
        await this.database.runCommand(`UPDATE playlists SET playlist_name = ? WHERE playlist_id = ?`, [name, this.collectionID]);
    }
    resetCacheTimeout() {
        if (this.timer)
            clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.clearCallback(this);
        }, Collection.timeout * 60000);
    }
    getSuggestedTracks() {
        return new Promise(resolve => {
            if (this.suggestedTracksUpdate && Date.now() / 1000 - this.suggestedTracksUpdate < 3600)
                return resolve(Array.from(this.suggestedTracks));
            if (!this.trackList.length)
                return resolve([]);
            const trackIDs = this.trackList.map(track => track.trackID);
            const shuffledIds = shuffle(trackIDs);
            const allTrackIDs = [];
            const allTracks = [];
            const THREADS = Math.min(3, trackIDs.length);
            let openThreads = THREADS;
            async function loadSuggested(collection, trackID) {
                try {
                    const serviceManager = ServiceManager.getInstance();
                    const service = serviceManager.getServiceFromTrackID(trackID);
                    const parentTrack = await serviceManager.getTrackInfo(trackID);
                    const suggestions = await service.getSuggestedTracks(parentTrack);
                    for (let track of suggestions) {
                        if (!trackIDs.includes(track.trackID) && !allTrackIDs.includes(track.trackID)) {
                            allTrackIDs.push(track.trackID);
                            allTracks.push(track);
                        }
                    }
                    allTracks.push(...suggestions);
                }
                catch (e) {
                    console.error(e);
                }
                if (allTracks.length > 30 || !shuffledIds.length) {
                    if (--openThreads <= 0) {
                        collection.suggestedTracks = shuffle(allTracks).slice(0, 30);
                        collection.suggestedTracksUpdate = Math.floor(Date.now() / 1000);
                        resolve(Array.from(collection.suggestedTracks));
                    }
                }
                else {
                    loadSuggested(collection, shuffledIds.shift());
                }
            }
            for (let i = 0; i < THREADS && shuffledIds.length; i++) {
                loadSuggested(this, shuffledIds.shift());
            }
        });
    }
    toJson() {
        return {
            collectionID: this.collectionID,
            name: this.name,
            owner: this.owner.toJson(),
            trackList: this.trackList
        };
    }
}
Collection.timeout = Config().collection_cache_time;
export default Collection;
//# sourceMappingURL=Collection.js.map