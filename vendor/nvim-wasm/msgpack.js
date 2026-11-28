// Tiny MessagePack encoder/decoder for the subset Neovim RPC uses.
// Supports: nil, booleans, positive/negative fixint, int8/16/32/64,
// strings, binary, arrays, maps, ext.

export class Ext {
  constructor(type, data) {
    this.type = type;
    this.data = data;
  }
}

export function encode(value) {
  const bytes = [];
  write(value, bytes);
  return new Uint8Array(bytes);
}

function write(val, out) {
  if (val === null || val === undefined) {
    out.push(0xc0);
    return;
  }
  if (typeof val === "boolean") {
    out.push(val ? 0xc3 : 0xc2);
    return;
  }
  if (typeof val === "number") {
    writeNumber(val, out);
    return;
  }
  if (typeof val === "string") {
    writeString(val, out);
    return;
  }
  if (typeof val === "bigint") {
    writeBigInt(val, out);
    return;
  }
  if (Array.isArray(val)) {
    writeArray(val, out);
    return;
  }
  if (val instanceof Uint8Array) {
    writeBinary(val, out);
    return;
  }
  if (typeof val === "object") {
    writeMap(val, out);
    return;
  }
  throw new Error("Unsupported type in msgpack encode");
}

function writeNumber(num, out) {
  if (!Number.isFinite(num)) throw new Error("Cannot encode non-finite number");
  if (Number.isInteger(num)) {
    if (num >= 0 && num <= 0x7f) {
      out.push(num);
      return;
    }
    if (num < 0 && num >= -32) {
      out.push(0xe0 | (num + 32));
      return;
    }
    if (num >= -0x80 && num <= 0x7f) {
      out.push(0xd0, (num + 0x100) & 0xff);
      return;
    }
    if (num >= -0x8000 && num <= 0x7fff) {
      out.push(0xd1, (num >> 8) & 0xff, num & 0xff);
      return;
    }
    if (num >= -0x80000000 && num <= 0x7fffffff) {
      out.push(0xd2, (num >> 24) & 0xff, (num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff);
      return;
    }
    // Use int64
    writeBigInt(BigInt(num), out);
    return;
  }
  // float64
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setFloat64(0, num);
  out.push(0xcb, ...new Uint8Array(buf));
}

function writeBigInt(bi, out) {
  // Encode as signed int64
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigInt64(0, BigInt(bi));
  out.push(0xd3, ...new Uint8Array(buf));
}

function writeString(str, out) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const len = bytes.length;
  if (len <= 0x1f) {
    out.push(0xa0 | len);
  } else if (len <= 0xff) {
    out.push(0xd9, len);
  } else if (len <= 0xffff) {
    out.push(0xda, (len >> 8) & 0xff, len & 0xff);
  } else {
    out.push(0xdb, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff);
  }
  out.push(...bytes);
}

function writeBinary(bytes, out) {
  const len = bytes.length;
  if (len <= 0xff) {
    out.push(0xc4, len);
  } else if (len <= 0xffff) {
    out.push(0xc5, (len >> 8) & 0xff, len & 0xff);
  } else {
    out.push(0xc6, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff);
  }
  out.push(...bytes);
}

function writeArray(arr, out) {
  const len = arr.length;
  if (len <= 0x0f) {
    out.push(0x90 | len);
  } else if (len <= 0xffff) {
    out.push(0xdc, (len >> 8) & 0xff, len & 0xff);
  } else {
    out.push(0xdd, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff);
  }
  for (const item of arr) {
    write(item, out);
  }
}

function writeMap(map, out) {
  const keys = Object.keys(map);
  const len = keys.length;
  if (len <= 0x0f) {
    out.push(0x80 | len);
  } else if (len <= 0xffff) {
    out.push(0xde, (len >> 8) & 0xff, len & 0xff);
  } else {
    out.push(0xdf, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff);
  }
  for (const key of keys) {
    write(key, out);
    write(map[key], out);
  }
}

export class Decoder {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.buffer = new Uint8Array();
  }

  push(chunk) {
    this.buffer = concat(this.buffer, chunk);
    let offset = 0;
    while (offset < this.buffer.length) {
      try {
        const { value, nextOffset } = decodeValue(this.buffer, offset);
        offset = nextOffset;
        this.onMessage(value);
      } catch (err) {
        if (err && err.incomplete) break;
        throw err;
      }
    }
    if (offset > 0) {
      this.buffer = this.buffer.slice(offset);
    }
  }
}

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function needMore() {
  const err = new Error("incomplete msgpack buffer");
  err.incomplete = true;
  return err;
}

function decodeValue(buf, offset) {
  if (offset >= buf.length) throw needMore();
  const type = buf[offset];

  if (type <= 0x7f) return { value: type, nextOffset: offset + 1 };
  if (type >= 0x80 && type <= 0x8f) return decodeMap(buf, offset, type & 0x0f, 1);
  if (type >= 0x90 && type <= 0x9f) return decodeArray(buf, offset, type & 0x0f, 1);
  if (type >= 0xa0 && type <= 0xbf) return decodeString(buf, offset, type & 0x1f, 1);
  if (type >= 0xe0) return { value: type - 0x100, nextOffset: offset + 1 };

  switch (type) {
    case 0xc0: return { value: null, nextOffset: offset + 1 };
    case 0xc2: return { value: false, nextOffset: offset + 1 };
    case 0xc3: return { value: true, nextOffset: offset + 1 };
    case 0xc4: return decodeBinary(buf, offset, readLen(buf, offset + 1, 1), 2);
    case 0xc5: return decodeBinary(buf, offset, readLen(buf, offset + 1, 2), 3);
    case 0xc6: return decodeBinary(buf, offset, readLen(buf, offset + 1, 4), 5);
    case 0xc7: return decodeExt(buf, offset, readLen(buf, offset + 1, 1), 2);
    case 0xc8: return decodeExt(buf, offset, readLen(buf, offset + 1, 2), 3);
    case 0xc9: return decodeExt(buf, offset, readLen(buf, offset + 1, 4), 5);
    case 0xca: return decodeFloat32(buf, offset);
    case 0xcb: return decodeFloat64(buf, offset);
    case 0xcc: return decodeUInt(buf, offset, 1);
    case 0xcd: return decodeUInt(buf, offset, 2);
    case 0xce: return decodeUInt(buf, offset, 4);
    case 0xcf: return decodeUInt(buf, offset, 8);
    case 0xd0: return decodeInt(buf, offset, 1);
    case 0xd1: return decodeInt(buf, offset, 2);
    case 0xd2: return decodeInt(buf, offset, 4);
    case 0xd3: return decodeInt(buf, offset, 8);
    case 0xd4: return decodeFixExt(buf, offset, 1);
    case 0xd5: return decodeFixExt(buf, offset, 2);
    case 0xd6: return decodeFixExt(buf, offset, 4);
    case 0xd7: return decodeFixExt(buf, offset, 8);
    case 0xd8: return decodeFixExt(buf, offset, 16);
    case 0xd9: return decodeString(buf, offset, readLen(buf, offset + 1, 1), 2);
    case 0xda: return decodeString(buf, offset, readLen(buf, offset + 1, 2), 3);
    case 0xdb: return decodeString(buf, offset, readLen(buf, offset + 1, 4), 5);
    case 0xdc: return decodeArray(buf, offset, readLen(buf, offset + 1, 2), 3);
    case 0xdd: return decodeArray(buf, offset, readLen(buf, offset + 1, 4), 5);
    case 0xde: return decodeMap(buf, offset, readLen(buf, offset + 1, 2), 3);
    case 0xdf: return decodeMap(buf, offset, readLen(buf, offset + 1, 4), 5);
    default:
      throw new Error(`Unsupported msgpack type: 0x${type.toString(16)}`);
  }
}

function readLen(buf, offset, bytes) {
  if (offset + bytes > buf.length) throw needMore();
  let len = 0;
  for (let i = 0; i < bytes; i += 1) len = (len << 8) | buf[offset + i];
  return len >>> 0;
}

function decodeUInt(buf, offset, bytes) {
  if (offset + 1 + bytes > buf.length) throw needMore();
  let n = 0n;
  for (let i = 0; i < bytes; i += 1) n = (n << 8n) | BigInt(buf[offset + 1 + i]);
  const num = Number(n);
  return { value: bytes === 8 ? n : num, nextOffset: offset + 1 + bytes };
}

function decodeInt(buf, offset, bytes) {
  if (offset + 1 + bytes > buf.length) throw needMore();
  let n = 0n;
  for (let i = 0; i < bytes; i += 1) n = (n << 8n) | BigInt(buf[offset + 1 + i]);
  const signBit = 1n << BigInt(bytes * 8 - 1);
  if (n & signBit) n = n - (1n << BigInt(bytes * 8));
  const num = Number(n);
  return { value: bytes === 8 ? n : num, nextOffset: offset + 1 + bytes };
}

function decodeFloat32(buf, offset) {
  if (offset + 5 > buf.length) throw needMore();
  const view = new DataView(buf.buffer, buf.byteOffset + offset + 1, 4);
  return { value: view.getFloat32(0), nextOffset: offset + 5 };
}

function decodeFloat64(buf, offset) {
  if (offset + 9 > buf.length) throw needMore();
  const view = new DataView(buf.buffer, buf.byteOffset + offset + 1, 8);
  return { value: view.getFloat64(0), nextOffset: offset + 9 };
}

function decodeString(buf, offset, len, headerSize) {
  const start = offset + headerSize;
  const end = start + len;
  if (end > buf.length) throw needMore();
  const bytes = buf.slice(start, end);
  return { value: new TextDecoder().decode(bytes), nextOffset: end };
}

function decodeBinary(buf, offset, len, headerSize) {
  const start = offset + headerSize;
  const end = start + len;
  if (end > buf.length) throw needMore();
  return { value: buf.slice(start, end), nextOffset: end };
}

function decodeExt(buf, offset, len, headerSize) {
  // ext family:
  //   0xc7: ext 8  -> [len:u8][type:i8][data...]
  //   0xc8: ext 16 -> [len:u16][type:i8][data...]
  //   0xc9: ext 32 -> [len:u32][type:i8][data...]
  const typeOffset = offset + headerSize;
  const start = typeOffset + 1;
  const end = start + len;
  if (end > buf.length) throw needMore();
  const rawType = buf[typeOffset];
  const extType = rawType >= 0x80 ? rawType - 0x100 : rawType;
  const data = buf.slice(start, end);
  return { value: new Ext(extType, data), nextOffset: end };
}

function decodeFixExt(buf, offset, len) {
  // fixext family:
  //   0xd4..0xd8 -> [type:i8][data...]
  const typeOffset = offset + 1;
  const start = typeOffset + 1;
  const end = start + len;
  if (end > buf.length) throw needMore();
  const rawType = buf[typeOffset];
  const extType = rawType >= 0x80 ? rawType - 0x100 : rawType;
  const data = buf.slice(start, end);
  return { value: new Ext(extType, data), nextOffset: end };
}

function decodeArray(buf, offset, len, headerSize) {
  let o = offset + headerSize;
  const arr = [];
  for (let i = 0; i < len; i += 1) {
    const { value, nextOffset } = decodeValue(buf, o);
    arr.push(value);
    o = nextOffset;
  }
  return { value: arr, nextOffset: o };
}

function decodeMap(buf, offset, len, headerSize) {
  let o = offset + headerSize;
  const obj = {};
  for (let i = 0; i < len; i += 1) {
    const k = decodeValue(buf, o);
    const v = decodeValue(buf, k.nextOffset);
    obj[k.value] = v.value;
    o = v.nextOffset;
  }
  return { value: obj, nextOffset: o };
}
