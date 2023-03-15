import SQLite from "./database/SQLite.js";
import RestAPI from "./restapi/RestAPI.js";
import SoundCloud from "./service/SoundCloud.js";
import YoutubeMusic from "./service/YoutubeMusic.js";
import Youtube from "./service/Youtube.js";
import CollectionCache from "./collection/CollectionCache.js";
import APIVersionV1 from "./restapi/version/V1.js";
import UserCache from "./authentication/UserCache.js";
import Config from "./Config.js";

const database = new SQLite("music.db");
// await database.resetDatabase(); // uncomment to reset database on server start
// database.createSchema();
const api = new RestAPI(Config().server_port).start();

UserCache.getInstance().linkDatabase(database);
CollectionCache.getInstance().linkDatabase(database);

new YoutubeMusic();
new SoundCloud();
new Youtube();

new APIVersionV1(api);