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
        }, 60 * 60 * 1000);
    }
    toJson() {
        return {
            userID: this.userID,
            username: this.username
        };
    }
}
//# sourceMappingURL=User.js.map