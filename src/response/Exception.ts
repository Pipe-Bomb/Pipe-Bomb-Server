export default class Exception {
    public readonly reason: string | Error;

    constructor(reason: string | Exception | Error) {
        if (reason instanceof Exception) {
            this.reason = reason.reason;
        } else {
            this.reason = reason;
        }
    }
}