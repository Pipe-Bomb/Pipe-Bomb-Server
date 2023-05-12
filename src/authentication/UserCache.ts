import Axios from "axios";
import Database from "../database/Database.js";

import APIResponse from "../response/APIResponse.js";
import User from "./User.js";
import { generateHash } from "../Utils.js";

export default class UserCache {
    private static instance: UserCache = null;

    private database: Database;
    private users: Map<string, User> = new Map();
    private tokenMap: Map<string, string> = new Map();

    private constructor() {
        console.log("Created user cache");
    }

    public static getInstance(): UserCache {
        if (!this.instance) this.instance = new UserCache();
        return this.instance;
    }

    public linkDatabase(database: Database): this {
        this.database = database;
        return this;
    }

    public removeUserFromCache(user: string | User) {
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

    public async getUserByID(userID: string): Promise<User> {
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
        } catch (e) {
            console.error(`Couldn't check user cache for '${userID}'`, e);
        }
        return null;
    }

    public async getUserByToken(token: string): Promise<User> {
        if (!token) throw new APIResponse(401, "Access token is required");
        let userID = this.tokenMap.get(token);
        if (userID) return await this.getUserByID(userID);
        
        const response = (await Axios.get(`https://eyezah.com/authenticate/api/get-user?token=${token}`)).data;
        if (!response.id) {
            throw new APIResponse(401, "Invalid access token");
        }
        this.tokenMap.set(token, response.id);
        let user = await this.getUserByID(response.id);
        if (user) return user;
        user = new User(response.id, response.email, response.username, (user) => this.removeUserFromCache(user));
        this.users.set(response.id, user);
        try {
            await this.database.runCommand(`INSERT INTO users (user_id, email, username) VALUES (?, ?, ?)`, [user.userID, user.email, user.username]);
        } catch (e) {
            console.error(`Couldn't add user '${user.userID}' to user cache`, e);
        }
        return user;
    }

    public static getAvatarUrl(userID: string) {
        const value = generateHash(userID)();
        const imageID = Math.floor(value * 100001);
        return `https://www.thiswaifudoesnotexist.net/example-${imageID}.jpg`;
    }
}