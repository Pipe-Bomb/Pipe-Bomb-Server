import Config from "../Config.js";

export default class User {
    private static readonly timeout = Config().user_cache_time;

    userID: string;
    email: string;
    username: string;

    private timer: NodeJS.Timeout = null;
    private clearCallback: (user: User) => void;

    constructor(userID: string, email: string, username: string, clearCallback: (user: User) => void) {
        this.userID = userID;
        this.email = email;
        this.username = username;
        this.clearCallback = clearCallback;

        this.resetCacheTimeout();
    }

    public resetCacheTimeout() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.clearCallback(this);
        }, User.timeout * 60_000);
    }

    public toJson() {
        return {
            userID: this.userID,
            username: this.username
        }
    }
}