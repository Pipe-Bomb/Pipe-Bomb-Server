import APIResponse from "../response/APIRespose.js";
import Exception from "../response/Exception.js";
import Chart from "./Chart.js";

export default class ChartManager {
    private static instance: ChartManager;

    private charts: Map<string, Chart> = new Map();

    private constructor() {}

    public static getInstance() {
        if (!this.instance) this.instance = new ChartManager();
        return this.instance;
    }

    public registerChart(slug: string, chart: Chart) {
        if (this.charts.has(slug)) throw new Exception(`Cannot register chart! Slug '${slug}' is taken.`);
        this.charts.set(slug, chart);
        console.log(`Registered chart '${slug}'!`);
        const lastChecked = chart.getLastChecked();
        let wait = 3600_000 - Date.now() + lastChecked;
        if (!lastChecked) {
            wait = 3600_000;
            setTimeout(() => {
                chart.update().catch(() => {});
            });        
        }
        setTimeout(() => {
            chart.update().catch(() => {});
            setInterval(() => {
                chart.update().catch(() => {});
            }, 3600_000);
        }, wait);
    }

    public getChart(slug: string): Chart {
        if (!slug) throw new APIResponse(400, `Chart not specified`);
        const chart = this.charts.get(slug);
        if (!chart) throw new APIResponse(400, `Chart '${slug}' does not exist`);
        return chart;
    }

    public getChartList(): string[] {
        return Array.from(this.charts.keys());
    }
}