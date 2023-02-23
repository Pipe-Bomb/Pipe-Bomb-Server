import Express from "express";
import Cors from "cors";
import UserCache from "../authentication/UserCache.js";
import APIResponse from "../response/APIRespose.js";
import Exception from "../response/Exception.js";
import { Stream } from "stream";
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
        this.starting = true;
        this.express.listen(this.port, () => {
            this.started = true;
            console.log(`******\n\nAPI is listening on http://127.0.0.1:${this.port}`);
        });
        return this;
    }
    hasStarted() {
        return this.starting;
    }
    createRoute(method, route, requireAuthentication, callback) {
        this.express[method](route, async (req, res) => {
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
                    user
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
            res.status(callbackResponse.statusCode);
            if (callbackResponse.response instanceof Stream) {
                res.contentType("audio/mp3");
                return callbackResponse.response.pipe(res);
            }
            res.send(callbackResponse);
        });
    }
}
//# sourceMappingURL=RestAPI.js.map