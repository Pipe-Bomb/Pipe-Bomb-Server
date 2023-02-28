import Config from "../Config.js";
export default class User {
    constructor(userID, email, username, clearCallback) {
        this.timer = null;
        this.userID = userID;
        this.email = email;
        this.username = username;
        this.clearCallback = clearCallback;
        this.resetCacheTimeout();
    }
    resetCacheTimeout() {
        if (this.timer)
            clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.clearCallback(this);
        }, User.timeout * 60000);
    }
    toJson() {
        return {
            userID: this.userID,
            username: this.username
        };
    }
}
User.timeout = Config().user_cache_time;
//# sourceMappingURL=User.js.map