import User from "../authentication/User.js";
import UserCache from "../authentication/UserCache.js";
import Database from "../database/Database.js";
import Track from "../music/Track.js";
import APIResponse from "../response/APIRespose.js";
import ServiceManager from "../service/ServiceManager.js";
import Collection from "./Collection.js";

export default class CollectionCache {
    private static instance: CollectionCache = null;
    
    private database: Database;
    private collections: Map<number, Collection> = new Map();

    private constructor() {
        console.log("Created collection cache");
    }

    public static getInstance(): CollectionCache {
        if (!this.instance) this.instance = new CollectionCache();
        return this.instance;
    }

    public linkDatabase(database: Database): this {
        this.database = database;
        return this;
    }

    public async getCollection(collectionID: number, fastLoad: boolean, user?: User): Promise<Collection> {
        // todo: add authorization

        const cachedCollection = this.collections.get(collectionID);
        if (cachedCollection) return cachedCollection;

        const playlistInfo = await this.database.runQuery(`SELECT * FROM playlists WHERE playlist_id = ?`, [collectionID]);
        if (!playlistInfo.length) throw new APIResponse(400, `No collection with ID '${collectionID}'`);

        const trackList = await this.database.runQuery(`SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY track_position ASC`, [collectionID]);
        const newTracklist: Track[] = [];
        for (let trackInfo of trackList) {
            newTracklist.push(new Track(trackInfo.track_id));
        }

        const collection = new Collection(
            playlistInfo[0].playlist_id,
            playlistInfo[0].playlist_name,
            this.database, newTracklist,
            (collection) => this.removeCollectionFromCache(collection),
            await UserCache.getInstance().getUserByID(playlistInfo[0].user_id)
        );
        
        // if (!fastLoad) await collection.loadPage(0);

        this.collections.set(collectionID, collection);

        return collection;
    }

    public async createCollection(title: string, user: User, trackList?: string[]): Promise<Collection> {
        try {
            const data = await this.database.runCommand(`INSERT INTO playlists (playlist_name, user_id) VALUES (?, ?)`, [title, user.userID]);
            const collection = new Collection(
                data.lastInsertRowid,
                title,
                this.database,
                [],
                (collection) => this.removeCollectionFromCache(collection),
                user);

            for (let trackID of trackList) {
                try {
                    const track = await ServiceManager.getInstance().getTrackInfo(trackID);
                    await collection.addTrack(track);
                } catch (e) {
                    //console.error(e);
                }
            }
            this.collections.set(collection.collectionID, collection);
            return collection;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    public async deleteCollection(collection: Collection): Promise<void> {
        this.collections.delete(collection.collectionID);
        await this.database.runCommand(`DELETE FROM playlists WHERE playlist_id = ?`, [collection.collectionID]);
        await this.database.runCommand(`DELETE FROM playlist_tracks WHERE playlist_id = ?`, [collection.collectionID]);
    }

    public removeCollectionFromCache(collection: Collection): void {
        this.collections.delete(collection.collectionID);
    }

    public async getCollectionsByUser(user: User): Promise<Collection[]> {
        try {
            const data = await this.database.runQuery(`SELECT playlist_id from playlists WHERE user_id = ?`, [user.userID]);
            const collections: Collection[] = [];
            for (let entry of data) {
                try {
                    collections.push(await this.getCollection(entry.playlist_id, true));
                } catch (e) {
                    console.error(e);
                }
            }
            return collections;
        } catch (e) {
            console.error(e);
            return [];
        }
    }
}