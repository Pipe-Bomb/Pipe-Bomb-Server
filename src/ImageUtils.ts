import Axios from "axios";
import Track from "./music/Track.js";
import Jimp from "jimp";

export async function generateImageFromTracklist(tracks: Track[]) {
    let images: Jimp[] = [];
    for (let track of tracks) {
        if (!track.metadata?.image) continue;

        try {
            const { data } = await Axios.get(track.metadata?.image, {
                responseType: "arraybuffer"
            });
            const image = await Jimp.read(data);

            const width = image.getWidth();
            const height = image.getHeight();
            if (width != height) {
                const size = Math.min(width, height);
                image.cover(size, size);
            }

            images.push(image);
        } finally {
            if (images.length >= 4) break;
        }
    }
    if (!images.length) return null;

    if (images.length < 4) {
        images[0].resize(500, 500);
        return await images[0].getBufferAsync(Jimp.MIME_JPEG);
    }

    for (let image of images) {
        image.resize(250, 250);
    }

    const out = new Jimp(500, 500);
    out.composite(images[0], 0, 0);
    out.composite(images[1], 250, 0);
    out.composite(images[2], 0, 250);
    out.composite(images[3], 250, 250);
    return await out.getBufferAsync(Jimp.MIME_JPEG);
}