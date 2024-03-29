import Express from "express";
import Cors from "cors";
import UserCache from "../authentication/UserCache.js";
import APIResponse from "../response/APIResponse.js";
import Exception from "../response/Exception.js";
import RequestInfo from "./RequestInfo.js";
import User from "../authentication/User.js";
import Config from "../Config.js";
import { Stream } from "stream";
import PartialContentInfo from "./PartialContentInfo.js";
import Pmx from "pmx";
import UrlRoutes from "../UrlRoutes.js";

const probe = Pmx.probe();

const requestMeter = probe.meter({
    name: "API requests / second",
    samples: 1
});

export default class RestAPI {
    public readonly port: number;
    public readonly express = Express();
    private started = false;
    private starting = false;
    private urlRoutes: UrlRoutes;

    constructor(port: number) {
        this.port = port;
        this.express.use(Cors());
        this.express.use(Express.json());

        this.urlRoutes = new UrlRoutes(this);
    }

    public start(): this {
        if (this.started) {
            throw "RestAPI has already started!";
        }
        if (this.starting) {
            throw "RestAPI is already starting!";
        }

        this.createRoute("all", "*", false, async requestInfo => {
            return new APIResponse(404, `Unknown endpoint '${requestInfo.endpoint}'`);
        });

        this.starting = true;
        this.express.listen(
            this.port,
            () => {
                this.started = true;
                console.log(`******\n\nAPI is listening on http://127.0.0.1:${this.port} under name '${Config().server_name}'`);
            }
        );
        return this;
    }

    public hasStarted(): boolean {
        return this.starting;
    }

    public createRoute(method: "all" | "get" | "post" | "put" | "delete" | "patch" | "options" | "head", route: string, requireAuthentication: boolean, callback: (requestInfo: RequestInfo) => Promise<APIResponse>): void {
        this.express[method](route, async (req, res) => {
            const startTime = Date.now();
            requestMeter.mark();

            let callbackResponse: APIResponse | Exception;
            let user: User = null;
            try {
                if (requireAuthentication) {
                    const token = req.headers.authorization;
                    if (!token) throw new APIResponse(401, "Authentication rquired");
                    if (!token.startsWith("JWT ")) throw new APIResponse(400, "Only JWTs are supported");
                    user = await UserCache.getInstance().getUserByToken(token.substring(4));
                    if (!user) throw new APIResponse(401, "Invalid JWT");
                }
    
                const requestInfo: RequestInfo = {
                    parameters: req.params,
                    body: req.body,
                    user,
                    endpoint: req.url,
                    headers: req.headers,
                    protocol: req.protocol,
                    address: req.get("host")
                };

                callbackResponse = await callback(requestInfo);
            } catch (e) {
                if (e instanceof APIResponse || e instanceof Exception) {
                    callbackResponse = e;
                } else {
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
                    } else {
                        info.stream.pipe(res);
                    }
                } else {
                    res.end();
                }
                
                return;
            }

            res.status(callbackResponse.statusCode);

            if (callbackResponse.response instanceof Stream) {
                callbackResponse.response.pipe(res);
            } else if (callbackResponse.options?.type) {
                res.type(callbackResponse.options.type);
                res.send(callbackResponse.response);
            } else {
                res.send({
                    processTime: callbackResponse.processTime,
                    statusCode: callbackResponse.statusCode,
                    statusMessage: callbackResponse.statusMessage,
                    response: callbackResponse.response
                });
            }
        });
    }
}