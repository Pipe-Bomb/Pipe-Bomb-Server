import Express from "express";
import Cors from "cors";
import UserCache from "../authentication/UserCache.js";
import APIResponse from "../response/APIRespose.js";
import Exception from "../response/Exception.js";
import Config from "../Config.js";
import StreamInfo from "../service/StreamInfo.js";
export default class RestAPI {
    constructor(port) {
        this.express = Express();
        this.started = false;
        this.starting = false;
        this.port = port;
        this.express.use(Cors());
        this.express.use(Express.json());
    }
    start() {
        if (this.started) {
            throw "RestAPI has already started!";
        }
        if (this.starting) {
            throw "RestAPI is already starting!";
        }
        this.createRoute("all", "*", false, async (requestInfo) => {
            return new APIResponse(404, `Unknown endpoint '${requestInfo.endpoint}'`);
        });
        this.starting = true;
        this.express.listen(this.port, () => {
            this.started = true;
            console.log(`******\n\nAPI is listening on http://127.0.0.1:${this.port} under name '${Config().server_name}'`);
        });
        return this;
    }
    hasStarted() {
        return this.starting;
    }
    createRoute(method, route, requireAuthentication, callback) {
        this.express[method](route, async (req, res) => {
            const startTime = Date.now();
            let callbackResponse;
            let user = null;
            try {
                if (requireAuthentication) {
                    user = await UserCache.getInstance().getUserByToken(req.headers.authorization);
                    if (!user)
                        throw new APIResponse(401, "Invalid access token");
                }
                const requestInfo = {
                    parameters: req.params,
                    body: req.body,
                    user,
                    endpoint: req.url
                };
                callbackResponse = await callback(requestInfo);
            }
            catch (e) {
                if (e instanceof APIResponse || e instanceof Exception) {
                    callbackResponse = e;
                }
                else {
                    callbackResponse = new Exception(e);
                }
            }
            if (callbackResponse instanceof Exception) {
                console.error(`Internal server error!`, callbackResponse.reason);
            }
            if (!callbackResponse) {
                console.error(`Unknown internal server error!`);
            }
            if (!(callbackResponse instanceof APIResponse)) {
                callbackResponse = new APIResponse(500, "Internal server error");
            }
            callbackResponse.processTime = Date.now() - startTime;
            if (callbackResponse.statusCode == 301 || callbackResponse.statusCode == 302) {
                res.redirect(callbackResponse.statusCode, callbackResponse.response);
                return;
            }
            res.status(callbackResponse.statusCode);
            if (callbackResponse.response instanceof StreamInfo) {
                res.contentType(callbackResponse.response.contentType);
                if (callbackResponse.response.contentLength)
                    res.set({
                        "Content-Length": callbackResponse.response.contentLength
                    });
                callbackResponse.response.stream.pipe(res);
            }
            else {
                res.send(callbackResponse);
            }
        });
    }
}
//# sourceMappingURL=RestAPI.js.map