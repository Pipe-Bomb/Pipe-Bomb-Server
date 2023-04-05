import CollectionCache from "../../collection/CollectionCache.js";
import APIResponse from "../../response/APIRespose.js";
import ServiceManager from "../../service/ServiceManager.js";
import RequestInfo from "../RequestInfo.js";
import RestAPI from "../RestAPI.js";
import APIVersion from "./APIVersion.js";
import Config from "../../Config.js";
import Axios from "axios";
import PartialContentInfo from "../PartialContentInfo.js";
import ChartManager from "../../chart/ChartManager.js";
import FS from "fs";
import Path from "path";
import { DIRNAME, stripNonAlphanumeric } from "../../Utils.js";

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


        this.createRoute("get", "/services", false, async requestInfo => {
            const serviceManager = ServiceManager.getInstance();
            const services = serviceManager.getServiceList();
            
            interface Service {
                name: string,
                prefix: string
            };

            const out: Service[] = [];

            for (let service of services) {
                out.push({
                    name: service,
                    prefix: serviceManager.getService(service).prefix
                });
            }

            return new APIResponse(200, out);
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

        this.createRoute("get", "/playlists/:playlist_id/suggested", true, async requestInfo => {
            const collection = await this.getCollectionFromRequestInfo(requestInfo);
            const suggestions = await collection.getSuggestedTracks();
            return new APIResponse(200, suggestions);
        });
        

        this.createRoute("put", "/playlists/:playlist_id", true, async requestInfo => { // add/remove tracks to playlist
            const collection = await this.getCollectionFromRequestInfo(requestInfo);
            if (collection.owner.userID != requestInfo.user.userID) throw new APIResponse(401, `Not authorized to edit playlist`);

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
            if (collection.owner.userID != requestInfo.user.userID) throw new APIResponse(403, `Not authorized to delete playlist`);
            await CollectionCache.getInstance().deleteCollection(collection);
            return new APIResponse(204, null);
        });





        this.createRoute("post", "/search", true, async requestInfo => { // search for tracks
            const service = ServiceManager.getInstance().getService(requestInfo.body.service);
            const search = await service.search(requestInfo.body.query);
            return new APIResponse(200, search);
        });
        

        this.createRoute("get", "/audio/:track_id", false, async requestInfo => { // get audio for track
            const audio = await ServiceManager.getInstance().getAudio(requestInfo.parameters.track_id);

            if (audio.content instanceof Buffer) {
                return new APIResponse(200, new PartialContentInfo(audio.content, 0, audio.contentLength - 1, audio.contentLength, audio.contentType));
            }

            if (!audio.contentLength) {
                console.log("checking audio content-length");
                const start = Date.now();
                const { headers } = await Axios.head(audio.content, {
                    timeout: 3000
                });
                console.log("content-length check took", Math.floor((Date.now() - start) / 1000), "seconds");
                audio.contentLength = parseInt(headers["content-length"]);
            }

            const size = audio.contentLength;

            let start = 0;
            let end = size - 1;

            if (requestInfo.headers.range) {
                let split = requestInfo.headers.range.replace(/bytes=/, "").split("-");
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

            console.log("getting audio");
            const startTime = Date.now();
            const { data } = await Axios.get(audio.content, {
                responseType: "stream",
                headers: {
                  Range: `bytes=${start}-${end}`,
                },
                timeout: 5000
            });
            console.log("audio get took", Math.floor((Date.now() - startTime) / 1000), "seconds");

            return new APIResponse(206, new PartialContentInfo(data, start, end, size, audio.contentType));
        });

        this.createRoute("get", "/tracks/:track_id", true, async requestInfo => {
            const track = await ServiceManager.getInstance().getTrackInfo(requestInfo.parameters.track_id);
            return new APIResponse(200, track);
        });

        this.createRoute("get", "/tracks/:track_id/suggested", true, async requestInfo => {
            const serviceManager = ServiceManager.getInstance();
            const track = await serviceManager.getTrackInfo(requestInfo.parameters.track_id);
            const suggestions = await serviceManager.getServiceFromTrackID(track.trackID).getSuggestedTracks(track);
            return new APIResponse(200, suggestions);
        });


        this.createRoute("get", "/charts/:chart_id", true, async requestInfo => {
            const chartManager = ChartManager.getInstance();
            const chart = chartManager.getChart(requestInfo.parameters.chart_id);
            return new APIResponse(200, {
                slug: chart.getSlug(),
                name: chart.getName(),
                service: chart.service,
                trackList: await chart.getTracks()
            });
        });

        this.createRoute("get", "/charts", true, async requestInfo => {
            const chartManager = ChartManager.getInstance();
            const charts = chartManager.getChartList();
            const out = charts.map(chartName => {
                const chart = chartManager.getChart(chartName);
                return {
                    slug: chart.getSlug(),
                    name: chart.getName(),
                    service: chart.service
                }
            });
            return new APIResponse(200, out);
        });


        this.createRoute("get", "/serviceicon/:service_id", false, async requestInfo => {
            return new Promise(resolve => {
                const serviceName = requestInfo.parameters.service_id;

                const filePath = Path.join(DIRNAME, "..", "assets", "services", `${stripNonAlphanumeric(serviceName)}.png`);

                if (!FS.existsSync(filePath)) {
                    return resolve(new APIResponse(404, `'${serviceName}' is not a valid service!`));
                }

                resolve(new APIResponse(200, FS.createReadStream(filePath)));
            })
            
        });
    }

    private async getCollectionFromRequestInfo(requestInfo: RequestInfo) {
        if (!requestInfo.parameters.playlist_id) throw new APIResponse(400, `Missing collection ID`);
        if (isNaN(parseInt(requestInfo.parameters.playlist_id))) throw new APIResponse(400, `Invalid collection ID '${requestInfo.parameters.playlist_id}'`);
        return await CollectionCache.getInstance().getCollection(parseInt(requestInfo.parameters.playlist_id), false, requestInfo.user);
    }
}