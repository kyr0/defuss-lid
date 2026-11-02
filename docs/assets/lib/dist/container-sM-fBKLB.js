const decoder = new TextDecoder("utf-8", { fatal: true });
const TYPES = {
  f4: Float32Array,
  u4: Uint32Array,
  i4: Int32Array,
  u2: Uint16Array,
  u1: Uint8Array,
  i1: Int8Array
};
const VERSIONS = { DLID0001: 1, DLID0002: 2 };
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function toBytes(input) {
  return input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}
function parseContainer(input) {
  const bytes = toBytes(input);
  if (bytes.length < 12) throw new Error("not a DLID v1/v2 model");
  const magic = String.fromCharCode(...bytes.subarray(0, 8));
  const expectedVersion = VERSIONS[magic];
  if (expectedVersion === void 0) throw new Error("not a DLID v1/v2 model");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = view.getUint32(8, true);
  if (length > bytes.length - 12) throw new Error("truncated model header");
  const meta = JSON.parse(decoder.decode(bytes.subarray(12, 12 + length)));
  if (!isRecord(meta) || !isRecord(meta.sections)) throw new Error("invalid model format or payload size");
  const start = 12 + length + (4 - length % 4) % 4;
  if (meta.format !== "defuss-lid" || meta.version !== expectedVersion || meta.payload_bytes !== bytes.length - start) {
    throw new Error("invalid model format or payload size");
  }
  if (new Uint8Array(new Uint32Array([1]).buffer)[0] !== 1) throw new Error("big-endian JavaScript host is unsupported");
  const arrays = {};
  const shapes = {};
  const ranges = [];
  for (const [name, section] of Object.entries(meta.sections)) {
    const Type = isRecord(section) ? TYPES[section.dtype] : void 0;
    if (!Type || !Array.isArray(section.shape) || !section.shape.every((n) => Number.isSafeInteger(n) && n >= 0) || !Number.isSafeInteger(section.offset) || section.offset < 0 || section.offset % 4) {
      throw new Error("invalid section");
    }
    const count = section.shape.reduce((a, b) => a * b, 1);
    const end = section.offset + count * Type.BYTES_PER_ELEMENT;
    if (!Number.isSafeInteger(count) || end > meta.payload_bytes) throw new Error("section out of bounds");
    const position = bytes.byteOffset + start + section.offset;
    arrays[name] = position % Type.BYTES_PER_ELEMENT === 0 ? new Type(bytes.buffer, position, count) : new Type(bytes.slice(start + section.offset, start + end).buffer);
    shapes[name] = section.shape;
    if (end > section.offset) ranges.push([section.offset, end]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  if (ranges.some((range, i) => i > 0 && ranges[i - 1][1] > range[0])) throw new Error("overlapping sections");
  return { meta, arrays, shapes };
}

export { parseContainer as p, toBytes as t };
