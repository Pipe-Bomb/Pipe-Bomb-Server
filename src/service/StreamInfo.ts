export default class StreamInfo {
    private timer: ReturnType<typeof setTimeout>;
    private callback: () => void;

    public resetTimer() {
        if (this.timer) clearTimeout(this.timer);

        this.timer = setTimeout(this.callback, 60 * 60 * 1000);
    }

    public setCallback(callback: () => void) {
        this.callback = callback;
        this.resetTimer();
    }

    constructor(
        public content: string | Buffer,
        public contentType: string,
        public contentLength: number
    ) {}
}