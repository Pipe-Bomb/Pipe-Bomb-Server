import RestAPI from "./restapi/RestAPI.js";
import Config from "./Config.js"
import APIResponse from "./response/APIResponse.js";
import ServiceManager from "./service/ServiceManager.js";
import { convertArrayToString } from "./Utils.js";
import UserCache from "./authentication/UserCache.js";
import ChartManager from "./chart/ChartManager.js";
import CollectionCache from "./collection/CollectionCache.js";

export interface UrlInfo {
    title: string,
    subtitle: string,
    image?: string
}

export default class UrlRoutes {
    private config = Config();

    public constructor(private api: RestAPI) {

        this.newRedirect("track", "track", async id => {
            const track = await ServiceManager.getInstance().getTrackInfo(id);
            return {
                title: track.metadata.title,
                subtitle: convertArrayToString(track.metadata.artists),
                image: `/v1/tracks/${track.trackID}/thumbnail`
            };
        });

        this.newRedirect("user", "user", async id => {
            const user = await UserCache.getInstance().getUserByID(id);
            if (!user) throw "no user";
            return {
                title: user.username,
                subtitle: `${this.config.server_address}@${user.userID}`,
                image: UserCache.getAvatarUrl(user.userID)
            }
        });

        this.newRedirect("chart", "charts", async id => {
            const chart = ChartManager.getInstance().getChart(id);
            return {
                title: chart.getName(),
                subtitle: "From " + chart.service,
                image: `/v1/charts/${chart.getSlug()}/thumbnail`
            }
        });

        this.newRedirect("externalplaylist", "collection/playlist", async id => {
            const externalPlaylist = await ServiceManager.getInstance().getExternalCollection("playlist", id);
            return {
                title: externalPlaylist.name,
                subtitle: "From " + externalPlaylist.service.name,
                image: `/v1/externalplaylists/${externalPlaylist.collectionID}/thumbnail`
            }
        });

        this.newRedirect("playlist", "playlist", async id => {
            const collection = await CollectionCache.getInstance().getCollection(id);
            return {
                title: collection.getName(),
                subtitle: "By " + collection.owner.username,
                image: `/v1/playlists/${collection.collectionID}/thumbnail`
            }
        });
    }

    public newRedirect(subject: string, prefix: string, infoCallback: (id: string) => Promise<UrlInfo>) {
        this.api.createRoute("get", `/${subject}/:id`, false, async requestInfo => {
            const id: string = requestInfo.parameters.id;

            const url = `${this.config.url_open_proxy}#${prefix}/${this.config.server_address}@${id}`;

            let data: UrlInfo = null;
            try {
                data = await infoCallback(id);
            } finally {
                const title = data?.title ? (data.title + " - Pipe Bomb") : this.config.server_name;
                const description = data?.subtitle ? data.subtitle : "";
                const image = data?.image || "";


                const html = `
<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
${description ? `<meta property="og:description" content="${description}">` : ""}
${image ? `<meta property="og:image" content="${image}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta property="twitter:domain" content="${requestInfo.address}">
<meta property="twitter:url" content="${url}">
<meta name="twitter:title" content="${title}">
${description ? `<meta name="twitter:description" content="${description}">` : ""}
${image ? `<meta name="twitter:image" content="${image}">` : ""}

<meta http-equiv="refresh" content="2;url=${url}" />
<script>
location = "${url}";
</script>
</head>
</html>`;
                return new APIResponse(200, html, {
                    type: "html"
                });
            }
        });
    }
}