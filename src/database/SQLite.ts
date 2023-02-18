import BetterSQLite from "better-sqlite3";
import FS from "fs";

import Database from "./Database.js";

export default class SQLite extends Database {
    readonly databaseName: string;
    private connection: BetterSQLite.Database;

    public constructor(databaseName: string) {
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

    async runQuery(query: string, parameters?: (string | number)[]): Promise<any[]> {
        const statement = this.connection.prepare(query);
        const rows: any[] = statement.all(...parameters);
        return rows;
    }

    async execute(query: string): Promise<void> {
        this.connection.exec(query);
    }

    async runCommand(query: string, parameters?: (string | number)[]): Promise<any> {
        const statement = this.connection.prepare(query);
        const result = statement.run(...parameters);
        return result;
    }

    public resetDatabase(): Promise<void> {
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