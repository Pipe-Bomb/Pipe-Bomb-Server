import User from "../authentication/User.js";

export default interface RequestInfo {
    parameters: {
        [key: string]: string;
    };
    body: any,
    user: User
}