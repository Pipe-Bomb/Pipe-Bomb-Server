export default class User {
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
        }, 60 * 60 * 1000);
    }

    public toJson() {
        return {
            userID: this.userID,
            username: this.username
        }
    }
}