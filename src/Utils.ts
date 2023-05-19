import { dirname } from "path";
import { fileURLToPath } from "url";
import Http from "http";
import Https from "https";
import Axios from "axios";
import Config from "./Config.js";
const CONFIG = Config();

export function shuffle<Type>(array: Type[]) {
    const dupe = Array.from(array);
    let currentIndex = dupe.length,  randomIndex;
  
    while (currentIndex != 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [dupe[currentIndex], dupe[randomIndex]] = [dupe[randomIndex], dupe[currentIndex]];
    }
  
    return dupe;
}

export function convertArrayToString(items: string[]) {
  let out = "";
  for (let i = 0; i < items.length; i++) {
      if (i > 0) {
          if (i == items.length - 2) {
              out += " & ";
          } else {
              out += ", ";
          }
      }
      out += items[i];
  }
  return out;
}

export function wait(milliseconds: number) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}

export function concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
    let totalLength = 0;
    for (const buffer of buffers) {
        totalLength += buffer.byteLength;
    }
  
    const resultBuffer = new ArrayBuffer(totalLength);
  
    const resultArray = new Uint8Array(resultBuffer);
  
    let offset = 0;
    for (const buffer of buffers) {
        const bufferArray = new Uint8Array(buffer);
        for (let i = 0; i < buffer.byteLength; i++) {
            resultArray[offset + i] = bufferArray[i];
        }
        offset += buffer.byteLength;
    }
  
    return resultBuffer;
}

export const DIRNAME = dirname(fileURLToPath(import.meta.url));

export function stripNonAlphanumeric(input: string, allowSpaces: boolean) {
    if (allowSpaces) return input.replace(/[^0-9a-zA-Z ]/g, "");
    return input.replace(/[^0-9a-zA-Z]/g, "");
}

export function removeDuplicates<Type>(items: Type[], matchProperty?: (item: Type) => any) {
    if (matchProperty) {
        const existingMatchProperties: any[] = [];
        const newList: Type[] = [];
    
        for (let item of items) {
            const itemMatchProp = matchProperty(item);
            if (!existingMatchProperties.includes(itemMatchProp)) {
                existingMatchProperties.push(itemMatchProp);
                newList.push(item);
            }
        }
        items.splice(0, items.length, ...newList);
    } else {
        const newList: Type[] = [];
        for (let item of items) {
            if (!newList.includes(item)) {
                newList.push(item);
            }            
        }
        items.splice(0, items.length, ...newList);
    }
}

export function removeItems<Type>(items: Type[], shouldKeep: (item: Type) => boolean) {
    const newList: Type[] = [];

    for (let item of items) {
        if (shouldKeep(item)) newList.push(item);
    }

    items.splice(0, items.length, ...newList);
}

export function generateHash(seed?: string | number) {
    function nextHash(a: number) { 
        return function() {
          var t = a += 0x6D2B79F5;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    function generate(seed: string) {
        var hash = 0, i: number, chr: number;
        if (seed.length === 0) return hash;
        for (i = 0; i < seed.length; i++) {
            chr = seed.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        return hash;
    }

    const anySeed: any = seed;
    let numberSeed: number;

    if (!seed) {
        seed = "";
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i < 20; i++) {
            seed += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        numberSeed = generate(seed);
    } else if (isNaN(anySeed) || parseInt(anySeed) != parseFloat(anySeed)) {
        seed = seed.toString().substring(0, 20);
        while (seed.length < 20) seed += "0";
        numberSeed = generate(seed.toString());
    } else {
        numberSeed = parseInt(anySeed);
    }

    return nextHash(numberSeed);
}


const IPV6_REGEX = /^(([0-9a-f]{1,4}:)(:[0-9a-f]{1,4}){1,6}|([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,5}|([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,4}|([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,3}|([0-9a-f]{1,4}:){1,5}(:[0-9a-f]{1,4}){1,2}|([0-9a-f]{1,4}:){1,6}(:[0-9a-f]{1,4})|([0-9a-f]{1,4}:){1,7}(([0-9a-f]{1,4})|:))\/(1[0-1]\d|12[0-8]|\d{1,2})$/;

export function generateIpv6(block: string) {
    if (!isIPv6(block)) throw Error('Invalid IPv6 format');
    const [rawAddr, rawMask] = block.split('/');
    let base10Mask = parseInt(rawMask);
    if (!base10Mask || base10Mask > 128 || base10Mask < 24) throw Error('Invalid IPv6 subnet');
    const base10addr = normalizeIp(rawAddr);
    const randomAddr = new Array(8).fill(1).map(() => Math.floor(Math.random() * 0xffff));
  
    const mergedAddr = randomAddr.map((randomItem, idx) => {
      const staticBits = Math.min(base10Mask, 16);
      base10Mask -= staticBits;
      const mask = 0xffff - ((2 ** (16 - staticBits)) - 1);
      return (base10addr[idx] & mask) + (randomItem & (mask ^ 0xffff));
    });
    return mergedAddr.map(x => x.toString(16)).join(':');
  };

export function isIPv6(ip: string) {
    return IPV6_REGEX.test(ip);
}

export default function normalizeIp(ip: string) {
    const parts = ip.split('::').map(x => x.split(':'));
    const partStart = parts[0] || [];
    const partEnd = parts[1] || [];
    partEnd.reverse();
    const fullIP: number[] = new Array(8).fill(0);
    for (let i = 0; i < Math.min(partStart.length, 8); i++) {
      fullIP[i] = parseInt(partStart[i], 16) || 0;
    }
    for (let i = 0; i < Math.min(partEnd.length, 8); i++) {
      fullIP[7 - i] = parseInt(partEnd[i], 16) || 0;
    }
    return fullIP;
};

export function getHttpAgent() {
    const subnet = CONFIG.ipv6_block;
    if (!subnet) return {};

    const options = {
        localAddress: generateIpv6(subnet),
        family: 6
    };

    console.log(options.localAddress);

    return {
        httpAgent: new Http.Agent(options),
        httpsAgent: new Https.Agent(options)
    };
}

for (let i = 0; i < 10; i++) {
    console.log(generateIpv6(CONFIG.ipv6_block));
}

Axios.get("https://development.eyezah.com").then(console.log, console.error);