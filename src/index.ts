import SQLite from "./database/SQLite.js";
import RestAPI from "./restapi/RestAPI.js";
import SoundCloud from "./service/SoundCloud.js";
import YoutubeMusic from "./service/YoutubeMusic.js";
import Youtube from "./service/Youtube.js";
import CollectionCache from "./collection/CollectionCache.js";
import APIVersionV1 from "./restapi/version/V1.js";
import UserCache from "./authentication/UserCache.js";
import Config from "./Config.js";
import BeatportChart from "./chart/BeatportChart.js";
import SoundCloudChart from "./chart/SoundCloudChart.js";

const database = new SQLite("music.db");
// await database.resetDatabase(); // uncomment to reset database on server start
// database.createSchema();
const api = new RestAPI(Config().server_port);

UserCache.getInstance().linkDatabase(database);
CollectionCache.getInstance().linkDatabase(database);

new YoutubeMusic();
new SoundCloud();
new Youtube();

new BeatportChart("top-100", "top-100", "Beatport Top 100");
new BeatportChart("genre/drum-bass/1/top-100", "dnb-top-100", "Beatport Drum & Bass Top 100");
new BeatportChart("genre/tech-house/11/top-100", "tech-house-top-100", "Beatport Tech House Top 100");
new BeatportChart("genre/dubstep/18/top-100", "dubstep-top-100", "Beatport Dubstep Top 100");
new BeatportChart("genre/bass-house/91/top-100", "bass-house-top-100", "Beatport Bass House Top 100");

new SoundCloudChart("charts-top:all-music", "soundcloud-top-50", "SoundCloud Top 50");
new SoundCloudChart("charts-top:hiphoprap", "soundcloud-top-50-hiphoprap", "SoundCloud Hip-Hop & Rap Top 50");
new SoundCloudChart("charts-top:pop", "soundcloud-top-50-pop", "SoundCloud Pop Top 50");
new SoundCloudChart("charts-top:house", "soundcloud-top-50-house", "SoundCloud House Top 50");
new SoundCloudChart("charts-top:electronic", "soundcloud-top-50-electronic", "SoundCloud Electronic Top 50");
new SoundCloudChart("charts-top:rbsoul", "soundcloud-top-50-rbsoul", "SoundCloud R&B & Soul Top 50");
new SoundCloudChart("charts-top:danceedm", "soundcloud-top-50-danceedm", "SoundCloud Dance & EDM Top 50");
new SoundCloudChart("charts-top:rock", "soundcloud-top-50-rock", "SoundCloud Rock Top 50");
new SoundCloudChart("charts-top:drumbass", "soundcloud-top-50-dnb", "SoundCloud Drum & Bass Top 50");
new SoundCloudChart("charts-top:reggae", "soundcloud-top-50-reggae", "SoundCloud Reggae Top 50");
new SoundCloudChart("charts-top:country", "soundcloud-top-50-country", "SoundCloud Country Top 50");
new SoundCloudChart("charts-top:techno", "soundcloud-top-50-techno", "SoundCloud Techno Top 50");
new SoundCloudChart("charts-top:soundtrack", "soundcloud-top-50-soundtrack", "SoundCloud Soundtrack Top 50");
new SoundCloudChart("charts-top:folksingersongwriter", "soundcloud-top-50-folksingersongwriter", "SoundCloud Folk & Singer-Songwriter Top 50");
new SoundCloudChart("charts-top:dubstep", "soundcloud-top-50-dubstep", "SoundCloud Dubstep Top 50");
new SoundCloudChart("charts-top:ambient", "soundcloud-top-50-ambient", "SoundCloud Ambient Top 50");
new SoundCloudChart("charts-top:classical", "soundcloud-top-50-classical", "SoundCloud Classical Top 50");
new SoundCloudChart("charts-top:trance", "soundcloud-top-50-trance", "SoundCloud Trance Top 50");
new SoundCloudChart("charts-top:alternativerock", "soundcloud-top-50-alternativerock", "SoundCloud Alternative Rock Top 50");
new SoundCloudChart("charts-top:metal", "soundcloud-top-50-metal", "SoundCloud Metal Top 50");
new SoundCloudChart("charts-top:deephouse", "soundcloud-top-50-deephouse", "SoundCloud Deep House Top 50");
new SoundCloudChart("charts-top:trap", "soundcloud-top-50-trap", "SoundCloud Trap Top 50");
new SoundCloudChart("charts-top:indie", "soundcloud-top-50-indie", "SoundCloud Indie Top 50");
new SoundCloudChart("charts-top:jazzblues", "soundcloud-top-50-jazzblues", "SoundCloud Jazz & Blues Top 50");
new SoundCloudChart("charts-top:latin", "soundcloud-top-50-latin", "SoundCloud Latin Top 50");
new SoundCloudChart("charts-top:dancehall", "soundcloud-top-50-dancehall", "SoundCloud Dancehall Top 50");
new SoundCloudChart("charts-top:reggaeton", "soundcloud-top-50-reggaeton", "SoundCloud Reggaeton Top 50");
new SoundCloudChart("charts-top:disco", "soundcloud-top-50-disco", "SoundCloud Disco Top 50");
new SoundCloudChart("charts-top:piano", "soundcloud-top-50-piano", "SoundCloud Piano Top 50");
new SoundCloudChart("charts-top:triphop", "soundcloud-top-50-triphop", "SoundCloud Triphop Top 50");

new APIVersionV1(api);

api.start();