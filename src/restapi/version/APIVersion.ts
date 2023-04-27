import APIResponse from "../../response/APIResponse.js";
import RequestInfo from "../RequestInfo.js";
import RestAPI from "../RestAPI.js";

export default abstract class APIVersion {
    private readonly restAPI: RestAPI;
    private readonly version: string;

    public constructor(version: string, restAPI: RestAPI) {
        this.version = version;
        this.restAPI = restAPI;
    }

    public createRoute(method: "all" | "get" | "post" | "put" | "delete" | "patch" | "options" | "head", route: string, requireAuthentication: boolean, callback: (requestInfo: RequestInfo) => Promise<APIResponse>): void {
        this.restAPI.createRoute(method, `/${this.version}${route}`, requireAuthentication, callback);
    }
}