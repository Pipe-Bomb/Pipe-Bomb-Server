import Axios from "axios";
import Track from "./music/Track.js";
import Jimp from "jimp";
import Sharp from "sharp";

export async function getImageBuffer(url: string): Promise<Buffer> {
    try {
        const data = await Axios.get(url, {
            responseType: "arraybuffer"
        });
        const type = data.headers["content-type"];
        const parts = type.split("/");
        if (parts.length != 2 || parts[0] != "image") throw "invalid content type";

        if (!["png", "jpeg", "bmp", "tiff", "gif"].includes(parts[1])) {
            const buffer = await Sharp(data.data).toFormat("jpg").toBuffer();
            return buffer;
        }

        return data.data;
    } catch {
        throw `Failed to get image at url '${url}'`;
    }
}

export async function generateImageFromTracklist(tracks: Track[]) {
    let images: Jimp[] = [];
    for (let track of tracks) {
        if (!track.metadata?.image) continue;

        try {
            const data = await getImageBuffer(track.metadata.image);
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

export async function cropImage(image: Buffer | string, scaleTo500?: boolean) {
    let buffer: Buffer;
    if (typeof image == "string") {
        try {
            buffer = await getImageBuffer(image);
        } catch {
            return null;
        }
    } else {
        buffer = image;
    }

    const jimp = await Jimp.read(buffer);
    const width = jimp.getWidth();
    const height = jimp.getHeight();
    if (width != height) {
        const size = Math.min(width, height);
        jimp.cover(size, size);
    }

    if (scaleTo500) {
        jimp.resize(500, 500);
    }
    return await jimp.getBufferAsync(Jimp.MIME_JPEG);
}