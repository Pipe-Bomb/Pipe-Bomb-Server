export default class StreamInfo {
    resetTimer() {
        if (this.timer)
            clearTimeout(this.timer);
        this.timer = setTimeout(this.callback, 60 * 60 * 1000);
    }
    setCallback(callback) {
        this.callback = callback;
        this.resetTimer();
    }
    constructor(url, contentType, contentLength) {
        this.url = url;
        this.contentType = contentType;
        this.contentLength = contentLength;
    }
}
//# sourceMappingURL=StreamInfo.js.map