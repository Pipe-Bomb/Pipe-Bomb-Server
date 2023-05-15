import Cryptico from "cryptico";
import Database from "../database/Database.js";

import APIResponse from "../response/APIResponse.js";
import User from "./User.js";
import { generateHash } from "../Utils.js";
import { randomBytes } from "crypto";
import JWT from "jsonwebtoken";
import FS from "fs";
import Path from "path";

export default class UserCache {
    private static instance: UserCache = null;

    private database: Database;
    private users: Map<string, User> = new Map();
    private secretsCache: Map<string, string> = new Map();
    private jwtSecret: string;

    private constructor() {
        console.log("Created user cache");

        if (!FS.existsSync(".secrets")) {
            console.log("Creating secrets directory...");
            FS.mkdirSync(".secrets");
            console.log("Created secrets directory!");
        }

        try {
            const fileSecret = FS.readFileSync(Path.join(".secrets", "jwt.txt")).toString("utf-8");
            if (!fileSecret) throw "unset";
            this.jwtSecret = fileSecret;
            console.log("Loaded JWT secret!");
        } catch {
            console.log("Creating new JWT secret...");
            let secret: string;
            do {
                const length = 900 + Math.floor(Math.random() * 100);
                const rawSecret = randomBytes(length).toString("base64");
                secret = rawSecret.match(/.{1,50}/g)?.join("\n");
            } while (!secret);
            FS.writeFileSync(Path.join(".secrets", "jwt.txt"), secret);
            this.jwtSecret = secret;
            console.log("Created new JWT secret!");
        }
        
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
                const user = new User(cache[0].user_id, cache[0].username, (user) => this.removeUserFromCache(user));
                this.users.set(user.userID, user);
                return user;
            }
        } catch (e) {
            console.error(`Couldn't check user cache for '${userID}'`, e);
        }
        return null;
    }

    public async getUserByToken(jwt: string): Promise<User> {
        if (!jwt) throw new APIResponse(401, "JWT is required");

        return new Promise((resolve, reject) => {
            JWT.verify(jwt, this.jwtSecret, async (err, decoded) => {
                if (err) return reject(new APIResponse(401, "Invalid JWT"));

                const anyID: any = decoded.sub;
                const userID: string = anyID;

                let user = await this.getUserByID(userID);
                if (user) return resolve(user);

                reject(new APIResponse(401, `Invalid JWT`));
            });
        });
    }

    public generateAuthenticationSecret(userID: string, publicKey: string): string {
        const generatedUserID: string = Cryptico.publicKeyID(publicKey);
        if (generatedUserID != userID) throw new APIResponse(401, "user ID and public key don't match");

        let secret: string;
        do {
            secret = randomBytes(300).toString("base64");
        } while (this.secretsCache.has(secret));

        const encrypted = Cryptico.encrypt(secret, publicKey);
        if (encrypted.status != "success") throw `Failed to encrypt secret`;
        
        this.secretsCache.set(secret, generatedUserID);
        setTimeout(() => {
            this.secretsCache.delete(secret);
        }, 300_000);
        return encrypted.cipher;
    }

    public verifyAuthenticationSecret(userID: string, secret: string) {
        const verifiedID = this.secretsCache.get(secret);
        return verifiedID && verifiedID == userID
    }

    public async generateJWT(userID: string, username?: string) {
        if (username) {
            const user = await this.getUserByID(userID);
            if (!user) {
                try {
                    await this.database.runCommand(`INSERT INTO users (user_id, username) VALUES (?, ?)`, [userID, username]);
                    console.log("created user!");
                    const newUser = new User(userID, username, (user) => this.removeUserFromCache(user));
                    this.users.set(newUser.userID, newUser);
                } catch (e) {
                    console.error(e);
                    throw `Couldn't add user '${userID}' to user cache`;
                }
            }
        }

        const token = JWT.sign({
            sub: userID
        }, this.jwtSecret, {
            expiresIn: "30d"
        });
        return token;
    }

    public static getAvatarUrl(userID: string) {
        const value = generateHash(userID)();
        const imageID = Math.floor(value * 100001);
        return `https://www.thiswaifudoesnotexist.net/example-${imageID}.jpg`;
    }
}