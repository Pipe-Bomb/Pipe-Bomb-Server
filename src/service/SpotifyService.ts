import SpotifyMetaHandler from "../SpotifyMetaHandler.js";
import { convertArrayToString, removeDuplicates } from "../Utils.js";
import ExternalCollection from "../collection/ExternalCollection.js";
import Track from "../music/Track.js";
import ServiceManager from "./ServiceManager.js";
import StreamInfo from "./StreamInfo.js";
import StreamingService, { SearchOptions, UrlType } from "./StreamingService.js";

export default class SpotifyService extends StreamingService {
    private spotify = SpotifyMetaHandler.getInstance();

    public constructor() {
        super("Spotify", "sp", {
            tracks: false,
            playlists: true,
            search: !SpotifyMetaHandler.getInstance().isDisabled()
        });
    }

    public async convertUrl(url: string): Promise<UrlType> {
        if (!url.startsWith("open.spotify.com/")) return null;

        if (url.includes("?")) url = url.split("?")[0];
        const split = url.split("/");
        split.shift();

        if (split.length == 2 && split[0] == "playlist") {
            return {
                type: "playlist",
                id: "sp-" + split[1]
            }
        }

        if (split.length == 2 && split[0] == "track") {
            try {
                const { body } = await (await this.spotify.getApi()).getTrack(split[1]);
                
                const artists = body.artists.map(artist => artist.name);
                const query = convertArrayToString(artists) + " - " + body.name;

                const results = await ServiceManager.getInstance().convertNamesToTracks("Youtube Music", query);
                const track = results[0].track;
                if (!track) throw "no track";

                return {
                    type: "track",
                    id: track.trackID
                }
            } catch (e) {
                console.error(e);
                return null;
            }
        }

        return null;
    }

    public async search(query: string, types: SearchOptions[], page?: number): Promise<(Track | ExternalCollection)[]> {
        if (!types.length) return [];
        let neededQueries = 0;
        if (types.includes("tracks")) neededQueries++;
        if (types.includes("playlists")) neededQueries++;

        const out: (Track | ExternalCollection)[] = [];

        const api = await this.spotify.getApi();
        const searchTypes: ("album" | "artist" | "playlist" | "track" | "show" | "episode")[] = [];
        if (types.includes("tracks")) searchTypes.push("track");
        if (types.includes("playlists")) searchTypes.push("playlist");
        if (types.includes("albums")) searchTypes.push("album");
        
        const { body } = await api.search(query, searchTypes);
        const link = this;

        return new Promise(resolve => {
            function end() {
                if (--neededQueries <= 0) {
                    removeDuplicates(out, item => {
                        if (item instanceof Track) {
                            return "track " + item.trackID;
                        }
                        if (item instanceof ExternalCollection) {
                            return item.type + " " + item.collectionID;
                        }
                    });
                    resolve(out);
                }
            }

            if (types.includes("tracks")) {
                const trackQueries: string[] = [];
                for (let track of body.tracks.items) {
                    const artists = track.artists.map(artist => artist.name);
                    trackQueries.push(convertArrayToString(artists) + " - " + track.name);
                }
                ServiceManager.getInstance().convertNamesToTracks("Youtube Music", ...trackQueries)
                .then(convertedTracks => {
                    out.push(...convertedTracks.map(track => track.track));
                }).finally(end);
            }


            if (types.includes("playlists")) {
                if (!body.playlists.items) {
                    end();
                } else {
                    let playlistsDone = 0;
                    async function doPlaylist(playlist: SpotifyApi.PlaylistObjectSimplified) {
                        try {
                            const tracklist = await link.spotify.getPlaylistTracklist(playlist.id);
                            
                            let thumbnailSize = 0;
                            let thumbnail: string | null = null;
                            for (let thumbnailData of playlist.images) {
                                const newSize = thumbnailData.width * thumbnailData.height;
                                if (newSize > thumbnailSize || !thumbnail) {
                                    thumbnailSize = newSize;
                                    thumbnail = thumbnailData.url;
                                }
                            }

                            const collection = new ExternalCollection("playlist", link, "sp-" + playlist.id, playlist.name, Date.now(), tracklist, thumbnail);
                            out.push(collection);
                        } finally {
                            if (++playlistsDone >= body.playlists.items.length) {
                                end();
                            }
                        }
                    }

                    for (let playlist of body.playlists.items) {
                        doPlaylist(playlist);
                    }
                }
                
            }
        });
    }

    public getAudio(trackID: string): Promise<StreamInfo> {
        throw new Error("Method not implemented.");
    }

    public getTrack(trackID: string): Promise<Track> {
        throw new Error("Method not implemented.");
    }

    public getSuggestedTracks(track: Track): Promise<Track[]> {
        throw new Error("Method not implemented.");
    }

    public async getPlaylist(playlistID: string): Promise<ExternalCollection> {
        playlistID = this.convertTrackIDToLocal(playlistID);
        const api = await this.spotify.getApi();
        const playlist = (await api.getPlaylist(playlistID)).body;
        const tracklist = await this.spotify.getPlaylistTracklist(playlist.id);

        let thumbnailSize = 0;
        let thumbnail: string | null = null;
        for (let thumbnailData of playlist.images) {
            const newSize = thumbnailData.width * thumbnailData.height;
            if (newSize > thumbnailSize || !thumbnail) {
                thumbnailSize = newSize;
                thumbnail = thumbnailData.url;
            }
        }

        const collection = new ExternalCollection("playlist", this, "sp-" + playlist.id, playlist.name, Date.now(), tracklist, thumbnail);
        return collection;
    }
}