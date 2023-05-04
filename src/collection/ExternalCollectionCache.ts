import { ConfigTemplate } from "../Config.js";
import ExternalCollection from "./ExternalCollection.js";
import Config from "../Config.js"

export default class ExternalCollectionCache {
    private static instance: ExternalCollectionCache;

    private cache: Map<string, ExternalCollection> = new Map();
    private config: ConfigTemplate;

    public static getInstance() {
        if (!this.instance) this.instance = new ExternalCollectionCache();
        return this.instance;
    }

    private constructor() {
        this.config = Config();
    }

    public get(type: "playlist" | "album", collectionID: string) {
        const id = type + " " + collectionID;
        return this.cache.get(id) || null;
    }

    public set(collection: ExternalCollection) {
        const id = collection.type + " " + collection.collectionID;

        const existingCollection = this.cache.get(id);
        if (existingCollection) {
            collection.copyFromExistingCollection(existingCollection);
        }

        this.cache.set(id, collection);

        setTimeout(() => {
            const newCollection = this.cache.get(id);
            if (newCollection == collection) {
                this.cache.delete(id);
            }
        }, this.config.external_collection_cache_time * 60_000);
    }
}