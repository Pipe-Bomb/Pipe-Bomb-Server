import Track from "../music/Track.js";
import { Lyric, LyricSource, Lyrics } from "./LyricSource.js";
import Axios from "axios"
import LyricsManager from "./LyricsManager.js";
import { convertArrayToString, wait } from "../Utils.js";

export default class DeezerLyrics implements LyricSource {
    private token: string = null;
    private cookie: string = null;
    private cachedConversions: Map<string, any> = new Map();

    public constructor() {
        this.getToken();
        LyricsManager.getInstance().registerSource("deezer", this);
    }

    private async getToken() {
        try {
            const { data, headers } = await Axios.post("https://www.deezer.com/ajax/gw-light.php?api_version=1.0&api_token=null&input=3&method=deezer.getUserData");
            if (!this.token) console.log("Connected to Deezer!");
            this.token = data.results.checkForm;
            this.cookie = headers["set-cookie"].map(cookie => cookie.split(";")[0]).join("; ");
        } catch {}
        setTimeout(this.getToken, 3_600_000);
    }

    private waitForAuth() {
        return new Promise<void>(async resolve => {
            while (1) {
                if (this.token) return resolve();
                await wait(100);
            }
        });
    }

    public async searchTracks(track: Track) {
        const cachedConversion = this.cachedConversions.get(track.trackID);
        if (cachedConversion) return cachedConversion;

        try {
            const query = track.metadata.title + " - " + convertArrayToString(track.metadata.artists);

            const { data } = await Axios.get(`https://api.deezer.com/search?q=${query}`);
            for (let deezerTrack of data.data) {
                if (Math.abs(deezerTrack.duration - track.metadata.duration) < 2) {
                    this.cachedConversions.set(track.trackID, deezerTrack);
                    return deezerTrack;
                }
            }
        } catch {}
        return null;
    }

    public async getLyrics(track: Track): Promise<Lyrics> {
        const deezerTrack = await this.searchTracks(track);
        if (!deezerTrack) return null;

        await this.waitForAuth();
        try {
            const songID = deezerTrack.id.toString();
            const url = `https://www.deezer.com/ajax/gw-light.php?api_version=1.0&api_token=${this.token}&input=3&method=song.getLyrics`;
            const { data } = await Axios.post(url, {
                "sng_id": songID
            }, {
                headers: {
                    cookie: this.cookie
                }
            });
            if (data.error.length) throw data.error;

            if (data.results?.LYRICS_SYNC_JSON?.length) {
                const lyricList: Lyric[] = [];

                for (let deezerLyric of data.results.LYRICS_SYNC_JSON) {
                    if (deezerLyric.milliseconds !== undefined) {
                        const newLyricTime = parseInt(deezerLyric.milliseconds) / 1000;

                        if (lyricList.length) {
                            const lastLyric = lyricList[lyricList.length - 1];

                            if (!lastLyric.words && lastLyric.time - newLyricTime < 1) {
                                lyricList.pop();
                            }
                        }

                        lyricList.push({
                            time: newLyricTime,
                            words: deezerLyric.line
                        }, {
                            time: newLyricTime + parseInt(deezerLyric.duration) / 1000,
                            words: ""
                        });
                    } else if (lyricList.length) {
                        lyricList.push({
                            time: lyricList[lyricList.length - 1].time,
                            words: ""
                        });
                    }
                }

                return {
                    synced: true,
                    provider: "Deezer",
                    lyrics: lyricList
                }
            } else {
                const rawLyrics: string[] = data.results.LYRICS_TEXT.split("\n");

                const lyrics: Lyric[] = [];

                for (let deezerLyric of rawLyrics) {
                    lyrics.push({
                        words: deezerLyric.trim()
                    });
                }

                return {
                    synced: false,
                    provider: "Deezer",
                    lyrics
                }
            }
        } catch {}
        return null;
    }

}