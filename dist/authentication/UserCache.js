import Axios from "axios";
import APIResponse from "../response/APIResponse.js";
import User from "./User.js";
class UserCache {
    constructor() {
        this.users = new Map();
        this.tokenMap = new Map();
        console.log("Created user cache");
    }
    static getInstance() {
        if (!this.instance)
            this.instance = new UserCache();
        return this.instance;
    }
    linkDatabase(database) {
        this.database = database;
        return this;
    }
    removeUserFromCache(user) {
        if (user instanceof User) {
            user = user.userID;
        }
        this.users.delete(user);
        this.tokenMap.forEach((value, key) => {
            if (value == user) {
                this.tokenMap.delete(key);
            }
        });
    }
    async getUserByID(userID) {
        let user = this.users.get(userID);
        if (user) {
            user.resetCacheTimeout();
            return user;
        }
        try {
            const cache = await this.database.runQuery("SELECT * FROM users WHERE user_id = ?", [userID]);
            if (cache.length) {
                const user = new User(cache[0].user_id, cache[0].email, cache[0].username, (user) => this.removeUserFromCache(user));
                this.users.set(user.userID, user);
                return user;
            }
        }
        catch (e) {
            console.error(`Couldn't check user cache for '${userID}'`, e);
        }
        return null;
    }
    async getUserByToken(token) {
        if (!token)
            throw new APIResponse(401, "Access token is required");
        let userID = this.tokenMap.get(token);
        if (userID)
            return await this.getUserByID(userID);
        const response = (await Axios.get(`https://eyezah.com/authenticate/api/get-user?token=${token}`)).data;
        if (!response.id) {
            throw new APIResponse(401, "Invalid access token");
        }
        this.tokenMap.set(token, response.id);
        let user = await this.getUserByID(response.id);
        if (user)
            return user;
        user = new User(response.id, response.email, response.username, (user) => this.removeUserFromCache(user));
        this.users.set(response.id, user);
        try {
            await this.database.runCommand(`INSERT INTO users (user_id, email, username) VALUES (?, ?, ?)`, [user.userID, user.email, user.username]);
        }
        catch (e) {
            console.error(`Couldn't add user '${user.userID}' to user cache`, e);
        }
        return user;
    }
}
UserCache.instance = null;
export default UserCache;
//# sourceMappingURL=UserCache.js.map