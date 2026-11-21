const CHUNK_SIZE = 450; // bytes per block

async function readFileAsBytes(file) {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

async function sha256Hex(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function gzipBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzipBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function splitIntoBlocks(bytes, blockSize = CHUNK_SIZE) {
  const blocks = [];
  for (let i = 0; i < bytes.length; i += blockSize) {
    const block = new Uint8Array(blockSize); // zero padded to a fixed size
    block.set(bytes.slice(i, i + blockSize));
    blocks.push(block);
  }
  return blocks;
}

async function processFile(file) {
  const original = await readFileAsBytes(file);
  const hash = await sha256Hex(original);

  // Compress only if it actually makes the file smaller
  const compressed = await gzipBytes(original);
  const useGzip = compressed.length < original.length;
  const payload = useGzip ? compressed : original;

  return {
    name: file.name,
    size: original.length,        // original size
    payloadSize: payload.length,  // size after optional compression
    gzip: useGzip,
    hash,                         // hash of the ORIGINAL file
    blocks: splitIntoBlocks(payload)
  };
}