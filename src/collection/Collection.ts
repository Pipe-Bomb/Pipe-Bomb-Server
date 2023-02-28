import User from "../authentication/User.js";
import Database from "../database/Database.js";
import Track from "../music/Track.js";
import APIResponse from "../response/APIRespose.js";
import ServiceManager from "../service/ServiceManager.js";
import Config from "../Config.js";

export default class Collection {
    private static readonly timeout = Config().collection_cache_time;

    private readonly database: Database;
    public readonly collectionID: number;
    private name: string;
    public readonly owner: User;
    private trackList: Track[] = [];

    private timer: NodeJS.Timeout = null;
    private clearCallback: (collection: Collection) => void;

    public constructor(collectionID: number, name: string, database: Database, trackList: Track[], clearCallback: (collection: Collection) => void, owner?: User) {
        this.collectionID = collectionID;
        this.name = name;
        this.database = database;
        this.trackList = trackList;
        this.owner = owner || null;
        this.clearCallback = clearCallback;

        this.resetCacheTimeout();
    }

    public async loadPage(page: number): Promise<this> {
        const pageSize = 10;

        for (let i = page * pageSize; i < (page + 1) * pageSize; i++) {
            let track = this.trackList[i];
            if (!track) break;
            if (!track.isUnknown()) continue;
            try {
                const newTrack = await ServiceManager.getInstance().getTrackInfo(track.trackID);
                this.trackList[i] = newTrack;
            } catch (e) {
                console.log(`Failed to get track info for item '${i}' in playlist: '${track.trackID}'`, e);
            }
        }

        return this;
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

    public toJson() {
        return {
            collectionID: this.collectionID,
            name: this.name,
            owner: this.owner.toJson(),
            trackList: this.trackList
        }
    }
}