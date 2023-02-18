export default class Exception {
    public readonly reason: string;

    constructor(reason: string | Exception) {
        if (reason instanceof Exception) {
            this.reason = reason.reason;
        } else {
            this.reason = reason;
        }
    }
}