import RestAPI from "./restapi/RestAPI.js";
import Config from "./Config.js"
import APIResponse from "./response/APIResponse.js";

export default class UrlRoutes {
    private proxyUrl: string;
    private serverAddress: string;

    public constructor(private api: RestAPI) {
        const config = Config();
        this.proxyUrl = config.url_open_proxy;
        this.serverAddress = config.server_address;

        this.newRedirect("track", "track");
        this.newRedirect("playlist", "playlist");
        this.newRedirect("user", "user");
        this.newRedirect("chart", "charts");
        this.newRedirect("externalplaylist", "collection/playlist");
    }

    public newRedirect(subject: string, prefix: string) {
        this.api.createRoute("get", `/${subject}/:id`, false, async requestInfo => {
            const id: string = requestInfo.parameters.id;

            const url = `${this.proxyUrl}#${prefix}/${this.serverAddress}@${id}`;
            return new APIResponse(301, url);
        });
    }
}