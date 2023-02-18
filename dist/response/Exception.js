export default class Exception {
    constructor(reason) {
        if (reason instanceof Exception) {
            this.reason = reason.reason;
        }
        else {
            this.reason = reason;
        }
    }
}
//# sourceMappingURL=Exception.js.map