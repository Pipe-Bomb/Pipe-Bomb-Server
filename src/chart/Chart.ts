import Track from "../music/Track.js";
import ChartManager from "./ChartManager.js";

export default abstract class Chart {
    protected name: string;
    private slug: string;
    public readonly service: string;
    protected trackList: Track[] = [];
    public lastChecked = 0;

    public constructor(service: string, slug: string, name?: string) {
        this.service = service;
        this.slug = slug;
        this.name = name || "Unnamed Chart";
        ChartManager.getInstance().registerChart(this.slug, this);
    }

    public async getTracks() {
        return Array.from(this.trackList);
    }

    public abstract update(): Promise<Track[]>;

    public getName() {
        return this.name;
    }

    public getSlug() {
        return this.slug;
    }

    public getLastChecked() {
        return this.lastChecked;
    }
}