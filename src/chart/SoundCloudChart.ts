import Axios from "axios";
import Track from "../music/Track.js";
import SoundCloud, { getClientID } from "../service/SoundCloudService.js";
import Chart from "./Chart.js";
import ServiceManager from "../service/ServiceManager.js";

export default class SoundCloudChart extends Chart {
    private soundcloudSlug: string;

    public constructor(soundcloudSlug: string, slug: string, name: string) {
        super("SoundCloud", slug, name);
        this.soundcloudSlug = soundcloudSlug;
    }

    public async update(): Promise<Track[]> {
        const clientID = await getClientID();

        const { data } = await Axios.get(`https://api-v2.soundcloud.com/resolve?url=https://soundcloud.com/discover/sets/${this.soundcloudSlug}&client_id=${clientID}`);
        
        const trackIds: number[] = data.tracks.map(track => track.id);

        const tracks: (Track | number)[] = [];
        const lookupTracks: number[] = [];
        const serviceManager = ServiceManager.getInstance();
        const soundCloudService: any = serviceManager.getService("SoundCloud");
        const soundCloud: SoundCloud = soundCloudService;



        for (let trackID of trackIds) {
            const track = serviceManager.getTrackFromCache("sc-" + trackID);
            if (track) {
                tracks.push(track);
            } else {
                tracks.push(trackID);
                lookupTracks.push(trackID);
            }
        }

        const { data: trackListData } = await Axios.get("https://api-v2.soundcloud.com/tracks?ids=" + lookupTracks.join(",") + "&client_id=" + clientID);
        for (let trackData of trackListData) {
            const track = soundCloud.convertJsonToTrack(trackData);
            const index = lookupTracks.indexOf(trackData.id);
            if (index < 0) continue;
            tracks[index] = track;
        }

        const outputTracks: Track[] = [];
        for (let track of tracks) {
            if (track instanceof Track) outputTracks.push(track);
        }

        this.trackList = outputTracks;
        return Array.from(outputTracks);
    }

}