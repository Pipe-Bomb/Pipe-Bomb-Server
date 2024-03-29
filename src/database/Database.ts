export default abstract class Database {
    abstract runQuery(query: string, parameters?: (string | number)[]): Promise<any[]>;
    abstract execute(query: string): Promise<void>;
    abstract runCommand(query: string, parameters?: (string | number)[]): Promise<any>;
    public abstract resetDatabase(): Promise<void>;

    public createSchema(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const commands = [
`CREATE TABLE "playlist_tracks" (
    "playlist_id" INTEGER,
    "track_id" TEXT,
    "track_position" INTEGER,
    PRIMARY KEY("track_position" AUTOINCREMENT)
);`,
`CREATE TABLE "playlists" (
    "playlist_id" INTEGER,
    "playlist_name" TEXT,
    "user_id" TEXT,
    PRIMARY KEY("playlist_id" AUTOINCREMENT)
)`,
`CREATE TABLE "users" (
    "user_id" TEXT,
    "username" TEXT,
    PRIMARY KEY("user_id")
)`
                ];
                for (let command of commands) {
                    this.execute(command);
                }
                console.log("Created database schema");
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }
}