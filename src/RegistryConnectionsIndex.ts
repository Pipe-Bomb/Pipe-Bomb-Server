import Axios from "axios";
import Config, { ConfigTemplate } from "./Config.js";

export interface RegistryConnection {
    identifier: string,
    response: string
}

export default class RegistryConnectionsIndex {
    private static instance: RegistryConnectionsIndex;

    private config: ConfigTemplate;
    private warned = false;
    private pendingConnections: RegistryConnection[] = [];

    private constructor() {
        this.config = Config();
        for (let url of this.config.server_registry_urls) {
            this.connect(url, 30);
        }
    }

    public static getInstance() {
        if (!this.instance) this.instance = new RegistryConnectionsIndex();
        return this.instance;
    }


    private async connect(registryUrl: string, checkFrequency: number, failedPreviously?: boolean) {
        const address = this.config.server_address;
        if (address == "127.0.0.1") {
            if (!this.warned) {
                this.warned = true;
                console.log(`Server address is set to '127.0.0.1', registries won't be contacted since this address is not externally accessible!`);
            }
            return;
        }
        try {
            try {
                const { data } = await Axios.post(registryUrl + "/servers/announce", {
                    address: this.config.server_address
                });

                if (!data?.data?.identifier || !data?.data?.response || !data?.data?.checkFrequency || typeof data.data.identifier != "string" || typeof data.data.response != "string" || typeof data.data.checkFrequency != "number") {
                    throw "invalid response";
                }

                checkFrequency = Math.max(Math.min(data.data.checkFrequency, 30), 1);

                const connection: RegistryConnection = {
                    identifier: data.data.identifier,
                    response: data.data.response
                };
                this.pendingConnections.push(connection);
                failedPreviously = false;
                setTimeout(() => {
                    const index = this.pendingConnections.indexOf(connection);
                    if (index >= 0) {
                        this.pendingConnections.splice(index, 1);
                    }
                }, 60_000);
            } catch {
                if (!failedPreviously) {
                    console.error(`Failed to perform handshake with registry '${registryUrl}'`);
                    failedPreviously = true;
                }
            }

            setTimeout(() => {
                this.connect(registryUrl, checkFrequency, !!failedPreviously);
            }, checkFrequency * 60_000);
        } catch {
            
        }
    }

    public getResponse(identifier: string) {
        for (let connection of this.pendingConnections) {
            if (connection.identifier == identifier) return connection.response;
        }
        return null;
    }
}