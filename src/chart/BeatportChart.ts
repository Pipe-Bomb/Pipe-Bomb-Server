import Chart from "./Chart.js";
import Axios from "axios";
import { convertArrayToString } from "../Utils.js";
import ServiceManager from "../service/ServiceManager.js";
import Track from "../music/Track.js";

export default class BeatportChart extends Chart {
    private beatportSlug: string;

    public constructor(beatportSlug: string, slug: string, name: string) {
        super("Beatport", slug, name);
        this.beatportSlug = beatportSlug;
    }

    public update(): Promise<Track[]> {        
        return new Promise<Track[]>(async (resolve, reject) => {
            try {
                const { data } = await Axios.get("https://www.beatport.com/" + this.beatportSlug);
                const raw = data.split("window.Playables = ", 2)[1].split("};\n")[0] + "}";
                const json = JSON.parse(raw);
                const trackStrings: string[] = [];
                for (let trackData of json.tracks) {
                    const titleString: string = trackData.name;
                    const artistString = convertArrayToString(trackData.artists.map(artist => artist.name));
                    let remixString = "";
                    if (trackData.remixers.length) {
                        const remixListString = convertArrayToString(trackData.remixers.map(artist => artist.name));
                        remixString = ` (${remixListString} Remix)`;
                    }
                    trackStrings.push(artistString + " - " + titleString + remixString);
                }
                const tracks = await ServiceManager.getInstance().convertNamesToTracks("Youtube Music", ...trackStrings);
                const newTracklist: Track[] = [];
                for (let track of tracks) {
                    if (track.track) newTracklist.push(track.track);
                }
                this.trackList = newTracklist;
                resolve(Array.from(newTracklist));
            } catch (e) {
                reject(e);
            }
        });
    }
}