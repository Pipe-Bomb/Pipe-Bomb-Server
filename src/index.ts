import SQLite from "./database/SQLite.js";
import RestAPI from "./restapi/RestAPI.js";
import SoundCloud from "./service/SoundCloud.js";
import CollectionCache from "./collection/CollectionCache.js";
import APIVersionV1 from "./restapi/version/V1.js";
import UserCache from "./authentication/UserCache.js";

const database = new SQLite("music.db");
// await database.resetDatabase(); // uncomment to reset database on server start
// database.createSchema();
const api = new RestAPI(8000).start();

UserCache.getInstance().linkDatabase(database);
CollectionCache.getInstance().linkDatabase(database);

new SoundCloud();

new APIVersionV1(api);