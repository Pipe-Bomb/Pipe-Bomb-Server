import ChartManager from "./ChartManager.js";
export default class Chart {
    constructor(slug, name) {
        this.trackList = [];
        this.lastChecked = 0;
        this.slug = slug;
        this.name = name || "Unnamed Chart";
        ChartManager.getInstance().registerChart(this.slug, this);
    }
    async getTracks() {
        return Array.from(this.trackList);
    }
    getName() {
        return this.name;
    }
    getSlug() {
        return this.slug;
    }
    getLastChecked() {
        return this.lastChecked;
    }
}
//# sourceMappingURL=Chart.js.map