export default class APIVersion {
    constructor(version, restAPI) {
        this.version = version;
        this.restAPI = restAPI;
    }
    createRoute(method, route, requireAuthentication, callback) {
        this.restAPI.createRoute(method, `/${this.version}${route}`, requireAuthentication, callback);
    }
}
//# sourceMappingURL=APIVersion.js.map