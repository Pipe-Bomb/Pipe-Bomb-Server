import CollectionCache from "../../collection/CollectionCache.js";
import APIResponse from "../../response/APIRespose.js";
import ServiceManager from "../../service/ServiceManager.js";
import RequestInfo from "../RequestInfo.js";
import RestAPI from "../RestAPI.js";
import APIVersion from "./APIVersion.js";
import Config from "../../Config.js";

export default class APIVersionV1 extends APIVersion {
    constructor(restAPI: RestAPI) {
        super("v1", restAPI);
        const config = Config();

        this.createRoute("get", "/identify", false, async requestInfo => {
            return new APIResponse(200, {
                pipeBombServer: true,
                name: config.server_name
            });
        });
        

        this.createRoute("post", "/playlists", true, async requestInfo => { // create playlist
            if (typeof requestInfo.body?.playlist_title != "string") throw new APIResponse(400, `Missing property 'playlist_title'`);
            const playlistTitle: string = requestInfo.body.playlist_title;
            if (!playlistTitle) throw new APIResponse(400, `Missing property 'playlist_title'`);
            const trackList: string[] = [];
            if (Array.isArray(requestInfo.body.tracks)) {
                for (let trackID of requestInfo.body.tracks) {
                    if (typeof trackID == "string") trackList.push(trackID);
                }
            }
            
            const collection = await CollectionCache.getInstance().createCollection(playlistTitle, requestInfo.user, trackList);
            return new APIResponse(201, collection.toJson());
        });


        this.createRoute("get", "/playlists", true, async requestInfo => { // get playlists
            const collections = await CollectionCache.getInstance().getCollectionsByUser(requestInfo.user);
            return new APIResponse(200, collections.map(collection => {
                const info = collection.toJson();
                delete info.trackList;
                return info;
            }));
        });
        

        this.createRoute("get", "/playlists/:playlist_id", true, async requestInfo => { // get playlist
            const collection = await this.getCollectionFromRequestInfo(requestInfo);
            await collection.loadPage(0);
            return new APIResponse(200, collection.toJson());
        });
        

        this.createRoute("put", "/playlists/:playlist_id", true, async requestInfo => { // add/remove tracks to playlist
            const collection = await this.getCollectionFromRequestInfo(requestInfo);
            if (Array.isArray(requestInfo.body?.tracks?.add)) {
                for (let trackID of requestInfo.body.tracks.add) {
                    if (typeof trackID == "string") {
                        try {
                            await collection.addTrack(trackID);
                        } catch (e) {
                            //console.error(e);
                        }
                    }
                }
            }
            if (Array.isArray(requestInfo.body?.tracks?.remove)) {
                for (let trackID of requestInfo.body.tracks.remove) {
                    if (typeof trackID == "string") {
                        try {
                            await collection.removeTrack(trackID);
                        } catch (e) {
                            // console.error(e);
                        }
                    }
                }
            }
            if (typeof requestInfo.body?.name == "string") {
                collection.setName(requestInfo.body.name);
            }

            return new APIResponse(200, collection.toJson());
        });


        this.createRoute("delete", "/playlists/:playlist_id", true, async requestInfo => { // delete playlist
            const collection = await this.getCollectionFromRequestInfo(requestInfo);
            if (collection.owner.userID != requestInfo.user.userID) throw new APIResponse(401, `Not authorized to delete playlist`);
            await CollectionCache.getInstance().deleteCollection(collection);
            return new APIResponse(204, null);
        });





        this.createRoute("post", "/search", true, async requestInfo => { // search for tracks
            const service = ServiceManager.getInstance().getService(requestInfo.body.service);
            const search = await service.search(requestInfo.body.query);
            return new APIResponse(200, search);
        });
        

        this.createRoute("get", "/audio/:track_id", false, async requestInfo => { // get audio for track
            const service = ServiceManager.getInstance().getServiceFromTrackID(requestInfo.parameters.track_id);
            const audio = await service.getAudio(requestInfo.parameters.track_id);
            return new APIResponse(200, audio);
        });

        this.createRoute("get", "/tracks/:track_id", true, async requestInfo => {
            const track = await ServiceManager.getInstance().getTrackInfo(requestInfo.parameters.track_id);
            return new APIResponse(200, track);
        });
    }

    private async getCollectionFromRequestInfo(requestInfo: RequestInfo) {
        if (!requestInfo.parameters.playlist_id) throw new APIResponse(400, `Missing collection ID`);
        if (isNaN(parseInt(requestInfo.parameters.playlist_id))) throw new APIResponse(400, `Invalid collection ID '${requestInfo.parameters.playlist_id}'`)
        return await CollectionCache.getInstance().getCollection(parseInt(requestInfo.parameters.playlist_id), false, requestInfo.user);
    }
}