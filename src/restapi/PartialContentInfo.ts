import { Stream } from "stream";

export default class PartialContentInfo {
    public constructor(
        public stream: Stream,
        public start: number,
        public end: number,
        public size: number,
        public contentType: string
    ) {}
}