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

const database = new SQLite("music.db");
// await database.resetDatabase(); // uncomment to reset database on server start
// database.createSchema();
const api = new RestAPI(Config().server_port);

UserCache.getInstance().linkDatabase(database);
CollectionCache.getInstance().linkDatabase(database);

new YoutubeMusic();
new SoundCloud();
new Youtube();

// new BeatportTop100();
new BeatportChart("top-100", "top-100", "Top 100");
new BeatportChart("genre/drum-bass/1/top-100", "dnb-top-100", "Drum & Bass Top 100");
new BeatportChart("genre/tech-house/11/top-100", "tech-house-top-100", "Tech House Top 100");
new BeatportChart("genre/dubstep/18/top-100", "dubstep-top-100", "Dubstep Top 100");
new BeatportChart("genre/bass-house/91/top-100", "bass-house-top-100", "Bass House Top 100");

new APIVersionV1(api);

api.start();