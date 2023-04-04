import APIResponse from "../response/APIRespose.js";
import Exception from "../response/Exception.js";
export default class ChartManager {
    constructor() {
        this.charts = new Map();
    }
    static getInstance() {
        if (!this.instance)
            this.instance = new ChartManager();
        return this.instance;
    }
    registerChart(slug, chart) {
        if (this.charts.has(slug))
            throw new Exception(`Cannot register chart! Slug '${slug}' is taken.`);
        this.charts.set(slug, chart);
        console.log(`Registered chart '${slug}'!`);
        const lastChecked = chart.getLastChecked();
        let wait = 3600000 - Date.now() + lastChecked;
        if (!lastChecked) {
            wait = 3600000;
            setTimeout(() => {
                chart.update().catch(() => { });
            });
        }
        setTimeout(() => {
            chart.update().catch(() => { });
            setInterval(() => {
                chart.update().catch(() => { });
            }, 3600000);
        }, wait);
    }
    getChart(slug) {
        if (!slug)
            throw new APIResponse(400, `Chart not specified`);
        const chart = this.charts.get(slug);
        if (!chart)
            throw new APIResponse(400, `Chart '${slug}' does not exist`);
        return chart;
    }
    getChartList() {
        return Array.from(this.charts.keys());
    }
}
//# sourceMappingURL=ChartManager.js.map