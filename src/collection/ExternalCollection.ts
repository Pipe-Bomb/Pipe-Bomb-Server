import Track from "../music/Track.js";
import APIResponse from "../response/APIResponse.js";
import ServiceManager from "../service/ServiceManager.js";
import StreamingService from "../service/StreamingService.js";
import ExternalCollectionCache from "./ExternalCollectionCache.js";

export default class ExternalCollection {
    public constructor(
        public readonly type: "playlist" | "album",
        public readonly service: StreamingService,
        public readonly collectionID: string,
        public readonly name: string,
        private lastModified: number,
        private readonly trackList: (Track | (() => Promise<Track>))[],
        public readonly artworkUrl?: string
    ) {
        ExternalCollectionCache.getInstance().set(this);
    }

    public getTracklist(page?: number) {
        const pageSize = 10;
        const maxPage = Math.floor(this.trackList.length / pageSize);

        if (page < 0) page = 0;
        if (page > maxPage) throw new APIResponse(400, `Tracklist is only ${maxPage + 1} page${maxPage ? "s" : ""} long`);

        const startIndex = page * pageSize;
        const endIndex = Math.min((page + 1) * pageSize, this.trackList.length) - 1;

        const neededToComplete = endIndex - startIndex;
        let completed = 0;

        const modified = this.lastModified;

        return new Promise<Track[]>((resolve) => {
            const trackList = this.trackList;

            async function loadTrack(index: number, track: Track | (() => Promise<Track>)) {
                try {
                    if (track instanceof Track) {
                        if (track.isUnknown()) {
                            track = await ServiceManager.getInstance().getTrackInfo(track.trackID);
                            if (modified == this.last_modified) {
                                trackList[index] = track;
                            }
                        }
                    } else {
                        track = await track();
                        if (modified == this.last_modified) {
                            trackList[index] = track;
                        }
                    }
                } finally {
                    if (++completed >= neededToComplete) {
                        const out: Track[] = [];
                        for (let i = startIndex; i <= endIndex; i++) {
                            const tempTrack = trackList[i];
                            if (tempTrack instanceof Track) {
                                out.push(tempTrack);
                            }
                        }

                        resolve(out);
                    }
                }
            }

            for (let i = startIndex; i <= endIndex; i++) {
                loadTrack(i, trackList[i]);
            }
        });
    }

    public toJson() {
        return {
            type: this.type,
            collectionID: this.collectionID,
            service: this.service.name,
            name: this.name,
            size: this.trackList.length
        }
    }

    public copyFromExistingCollection(collection: ExternalCollection) {
        if (this.lastModified <= collection.lastModified) {
            this.trackList.splice(0, this.trackList.length, ...collection.trackList);
            this.lastModified = collection.lastModified;
        }
    }
}