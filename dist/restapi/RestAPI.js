import Express from "express";
import Cors from "cors";
import UserCache from "../authentication/UserCache.js";
import APIResponse from "../response/APIRespose.js";
import Exception from "../response/Exception.js";
import Config from "../Config.js";
import { Stream } from "stream";
import PartialContentInfo from "./PartialContentInfo.js";
import Pmx from "pmx";
const probe = Pmx.probe();
const requestMeter = probe.meter({
    name: "API requests / second",
    samples: 1
});
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
            requestMeter.mark();
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
                    endpoint: req.url,
                    headers: req.headers
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
                console.error(`Internal server error!\nroute:`, route, "\nurl:", req.url, "\nparameters:", req.params, "\nbody:", req.body, callbackResponse.reason);
            }
            if (!callbackResponse) {
                console.error(`Unknown internal server error!`);
            }
            if (!(callbackResponse instanceof APIResponse)) {
                callbackResponse = new APIResponse(500, "Internal server error");
            }
            callbackResponse.processTime = Date.now() - startTime;
            if (callbackResponse.options) {
                if (callbackResponse.options.cacheTime) {
                    res.set("Cache-control", `public, max-age=${callbackResponse.options.cacheTime}`);
                }
            }
            if (callbackResponse.statusCode == 301 || callbackResponse.statusCode == 302) {
                res.redirect(callbackResponse.statusCode, callbackResponse.response);
                return;
            }
            if (callbackResponse.statusCode == 416) {
                res.writeHead(416, {
                    "Content-Range": `bytes */${callbackResponse.response}`
                });
                res.end();
                return;
            }
            if (callbackResponse.response instanceof PartialContentInfo) {
                const info = callbackResponse.response;
                res.writeHead(206, {
                    "Content-Range": `bytes ${info.start}-${info.end}/${info.size}`,
                    "Accept-Ranges": "bytes",
                    "Content-Length": info.end - info.start + 1,
                    "Content-Type": info.contentType
                });
                if (req.method != "HEAD") {
                    if (info.stream instanceof Buffer) {
                        const bufferStream = new Stream.PassThrough();
                        bufferStream.end(info.stream);
                        bufferStream.pipe(res);
                    }
                    else {
                        info.stream.pipe(res);
                    }
                }
                else {
                    res.end();
                }
                return;
            }
            res.status(callbackResponse.statusCode);
            if (callbackResponse.response instanceof Stream) {
                callbackResponse.response.pipe(res);
            }
            else {
                res.send(callbackResponse);
            }
        });
    }
}
//# sourceMappingURL=RestAPI.js.map