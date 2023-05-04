import User from "../authentication/User.js";
import Database from "../database/Database.js";
import Track from "../music/Track.js";
import APIResponse from "../response/APIResponse.js";
import ServiceManager from "../service/ServiceManager.js";
import Config from "../Config.js";
import { shuffle } from "../Utils.js";

export default class Collection {
    private static readonly timeout = Config().collection_cache_time;

    private readonly database: Database;
    public readonly collectionID: string;
    private name: string;
    public readonly owner: User;
    private trackList: Track[] = [];
    private suggestedTracks: Track[] = [];
    private suggestedTracksUpdate: number = null;

    private timer: NodeJS.Timeout = null;
    private clearCallback: (collection: Collection) => void;

    public constructor(collectionID: string, name: string, database: Database, trackList: Track[], clearCallback: (collection: Collection) => void, owner?: User) {
        this.collectionID = collectionID;
        this.name = name;
        this.database = database;
        this.trackList = trackList;
        this.owner = owner || null;
        this.clearCallback = clearCallback;

        this.resetCacheTimeout();
    }

    public loadPage(page: number): Promise<void> {
        const pageSize = 10;

        return new Promise<void>(async (resolve, reject) => {
            let completedChecks = 0;

            async function loadTrack(collection: Collection, track: Track) {
                try {
                    const newTrack = await ServiceManager.getInstance().getTrackInfo(track.trackID);

                    for (let i = 0; i < collection.trackList.length; i++) {
                        if (collection.trackList[i].trackID == newTrack.trackID) {
                            collection.trackList[i] = newTrack;
                            break;
                        }
                    }
                } catch (e) {
                    console.log(`Failed to get track info for item in playlist '${collection.collectionID}': '${track.trackID}'`, e);
                } finally {
                    if (--completedChecks <= 0) {
                        resolve();
                    }
                }
            }


            for (let i = page * pageSize; i < (page + 1) * pageSize; i++) {
                let track = this.trackList[i];
                if (!track) break;
                if (!track.isUnknown()) continue;
                completedChecks++;
                loadTrack(this, track);
            }
            if (!completedChecks) resolve();
        });
    }

    public async addTrack(track: Track | string) {
        if (typeof track == "string") {
            track = await ServiceManager.getInstance().getTrackInfo(track);
        }
        for (let existingTrack of this.trackList) {
            if (existingTrack.trackID == track.trackID) throw new APIResponse(409, `Track '${track.trackID}' is already in collection`);
        }
        this.trackList.push(track);
        await this.database.runCommand(`INSERT INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)`, [this.collectionID, track.trackID]);
    }

    public async removeTrack(track: Track | string) {
        if (track instanceof Track) track = track.trackID;
        let index = -1;
        for (let i = 0; i < this.trackList.length; i++) {
            if (this.trackList[i].trackID == track) {
                index = i;
                break;
            }
        }
        if (index == -1) throw new APIResponse(409, `Track ${track} isn't in collection`);
        this.trackList.splice(index, 1);
        await this.database.runCommand(`DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?`, [this.collectionID, track]);
    }

    public async setName(name: string) {
        this.name = name;
        await this.database.runCommand(`UPDATE playlists SET playlist_name = ? WHERE playlist_id = ?`, [name, this.collectionID]);
    }

    public resetCacheTimeout() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.clearCallback(this);
        }, Collection.timeout * 60_000);
    }

    public getSuggestedTracks() {
        return new Promise<Track[]>(resolve => {
            if (this.suggestedTracksUpdate && Date.now() / 1000 - this.suggestedTracksUpdate < 3600) return resolve(Array.from(this.suggestedTracks));

            if (!this.trackList.length) return resolve([]);

            const trackIDs = this.trackList.map(track => track.trackID);
            const shuffledIds = shuffle(trackIDs);
    
            const allTrackIDs: string[] = [];
            const allTracks: Track[] = [];
            const THREADS = Math.min(3, trackIDs.length);

            let openThreads = THREADS;
    
            async function loadSuggested(collection: Collection, trackID: string) {
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
                } catch (e) {
                    console.error(e);
                }
                if (allTracks.length > 30 || !shuffledIds.length) {
                    if (--openThreads <= 0) {
                        collection.suggestedTracks = shuffle(allTracks).slice(0, 30);
                        collection.suggestedTracksUpdate = Math.floor(Date.now() / 1000);

                        resolve(Array.from(collection.suggestedTracks));
                    }
                } else {
                    loadSuggested(collection, shuffledIds.shift());
                }
            }
    
            for (let i = 0; i < THREADS && shuffledIds.length; i++) {
                loadSuggested(this, shuffledIds.shift());
            }
        });
    }

    public toJson() {
        return {
            collectionID: this.collectionID,
            name: this.name,
            owner: this.owner.toJson(),
            trackList: this.trackList
        }
    }
}