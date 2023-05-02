import Track from "../music/Track.js"

export interface Lyric {
    time?: number,
    words: string
}

export interface Lyrics {
    synced: boolean
    provider: string
    lyrics: Lyric[]
}

export interface LyricSource {
    getLyrics: (track: Track) => Promise<Lyrics | null>
}