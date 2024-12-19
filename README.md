# Pipe-Bomb-Server
### Docker instructions
Before we run the server you will have to build the pipe bomb docker image by doing;
```
$ docker build -t "pipe-bomb-server" .
```
After the image is built you want to find a place to put the container in, personally I will do it in `~/docker/pipe-bomb-server`. In the directory of your choosing make a `compose.yml` file which should look something like this.
```yaml
services:
  pipe-bomb-server:
    image: pipe-bomb-server
    container_name: pipe-bomb-server
    ports:
      - "8000:8000"
    # volumes:
    #   - ./Config.json:/usr/src/app/Config.json
    #   # the database has a volume incase you want to move/backup or do anything else with the files
    #   - ./database/music.db:/usr/src/app/music.db
    #   - ./database/music.db-shm:/usr/src/app/music.db-shm
    #   - ./database/music.db-wal:/usr/src/app/music.db-wal
    restart: unless-stopped
```
Keep the volumes commented out at first so we can let pipe bomb generate the files needed for the volumes, to let pipe bomb generate them run the following command.
```
$ docker compose up
```
When you see something like the line `API is listening on ___` it's done staring up and generating the files, you can now safely do `CTRL-c` to stop the server. Now we can uncomment the volumes but before we can run it again we must copy the generated files over.
```
$ docker cp pipe-bomb-server:/usr/src/app/Config.json .
$ mkdir database
$ docker cp pipe-bomb-server:/usr/src/app/music.db ./database/music.db
$ docker cp pipe-bomb-server:/usr/src/app/music.db-shm ./database/music.db-shm
$ docker cp pipe-bomb-server:/usr/src/app/music.db-wal ./database/music.db-wal
```
Feel free to edit the config as you like and once you are done with that you can run the server by doing this command (-d will run it in the background)
```
$ docker compose up
```
