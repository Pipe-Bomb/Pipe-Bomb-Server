import BetterSQLite from "better-sqlite3";
import FS from "fs";
import Database from "./Database.js";
export default class SQLite extends Database {
    constructor(databaseName) {
        super();
        this.databaseName = databaseName;
        const firstTimeSetup = !FS.existsSync(this.databaseName);
        this.connection = BetterSQLite(this.databaseName);
        this.connection.pragma(`journal_mode = WAL`);
        if (firstTimeSetup) {
            console.log(`SQLite database has been created for the first time, setting up now as "${this.databaseName}"...`);
            this.createSchema();
        }
    }
    async runQuery(query, parameters) {
        const statement = this.connection.prepare(query);
        const rows = statement.all(...parameters);
        return rows;
    }
    async execute(query) {
        this.connection.exec(query);
    }
    async runCommand(query, parameters) {
        const statement = this.connection.prepare(query);
        const result = statement.run(...parameters);
        return result;
    }
    resetDatabase() {
        return new Promise((resolve, reject) => {
            this.connection.close();
            console.log("Closed database");
            FS.unlinkSync(this.databaseName);
            this.connection = BetterSQLite(this.databaseName);
            console.log("Created new database");
            this.connection.pragma(`journal_mode = WAL`);
            resolve();
        });
    }
}
//# sourceMappingURL=SQLite.js.map