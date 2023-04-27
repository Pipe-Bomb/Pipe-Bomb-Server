import UserCache from "../authentication/UserCache.js";
import Track from "../music/Track.js";
import APIResponse from "../response/APIResponse.js";
import ServiceManager from "../service/ServiceManager.js";
import Collection from "./Collection.js";
class CollectionCache {
    constructor() {
        this.collections = new Map();
        console.log("Created collection cache");
    }
    static getInstance() {
        if (!this.instance)
            this.instance = new CollectionCache();
        return this.instance;
    }
    linkDatabase(database) {
        this.database = database;
        return this;
    }
    async getCollection(collectionID, fastLoad, user) {
        // todo: add authorization
        const cachedCollection = this.collections.get(collectionID);
        if (cachedCollection)
            return cachedCollection;
        const playlistInfo = await this.database.runQuery(`SELECT * FROM playlists WHERE playlist_id = ?`, [collectionID]);
        if (!playlistInfo.length)
            throw new APIResponse(400, `No collection with ID '${collectionID}'`);
        const trackList = await this.database.runQuery(`SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY track_position ASC`, [collectionID]);
        const newTracklist = [];
        for (let trackInfo of trackList) {
            newTracklist.push(new Track(trackInfo.track_id));
        }
        const collection = new Collection(playlistInfo[0].playlist_id, playlistInfo[0].playlist_name, this.database, newTracklist, (collection) => this.removeCollectionFromCache(collection), await UserCache.getInstance().getUserByID(playlistInfo[0].user_id));
        // if (!fastLoad) await collection.loadPage(0);
        this.collections.set(collectionID, collection);
        return collection;
    }
    async createCollection(title, user, trackList) {
        try {
            const data = await this.database.runCommand(`INSERT INTO playlists (playlist_name, user_id) VALUES (?, ?)`, [title, user.userID]);
            const collection = new Collection(data.lastInsertRowid, title, this.database, [], (collection) => this.removeCollectionFromCache(collection), user);
            for (let trackID of trackList) {
                try {
                    const track = await ServiceManager.getInstance().getTrackInfo(trackID);
                    await collection.addTrack(track);
                }
                catch (e) {
                    //console.error(e);
                }
            }
            this.collections.set(collection.collectionID, collection);
            return collection;
        }
        catch (e) {
            console.error(e);
            return null;
        }
    }
    async deleteCollection(collection) {
        this.collections.delete(collection.collectionID);
        await this.database.runCommand(`DELETE FROM playlists WHERE playlist_id = ?`, [collection.collectionID]);
        await this.database.runCommand(`DELETE FROM playlist_tracks WHERE playlist_id = ?`, [collection.collectionID]);
    }
    removeCollectionFromCache(collection) {
        this.collections.delete(collection.collectionID);
    }
    async getCollectionsByUser(user) {
        try {
            const data = await this.database.runQuery(`SELECT playlist_id from playlists WHERE user_id = ?`, [user.userID]);
            const collections = [];
            for (let entry of data) {
                try {
                    collections.push(await this.getCollection(entry.playlist_id, true));
                }
                catch (e) {
                    console.error(e);
                }
            }
            return collections;
        }
        catch (e) {
            console.error(e);
            return [];
        }
    }
}
CollectionCache.instance = null;
export default CollectionCache;
//# sourceMappingURL=CollectionCache.js.map