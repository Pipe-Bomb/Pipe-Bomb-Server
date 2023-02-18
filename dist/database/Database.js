export default class Database {
    createSchema() {
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
    "email" TEXT,
    "username" TEXT,
    PRIMARY KEY("user_id")
)`
                ];
                for (let command of commands) {
                    this.execute(command);
                }
                console.log("Created database schema");
                resolve();
            }
            catch (e) {
                reject(e);
            }
        });
    }
}
//# sourceMappingURL=Database.js.map