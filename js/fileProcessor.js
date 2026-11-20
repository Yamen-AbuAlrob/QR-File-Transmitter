const CHUNK_SIZE = 800; // bytes per chunk, small chunks give simpler QR codes

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

function splitIntoChunks(bytes, chunkSize = CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(bytes.slice(i, i + chunkSize));
  }
  return chunks;
}

async function processFile(file) {
  const bytes = await readFileAsBytes(file);
  const hash = await sha256Hex(bytes);
  const chunks = splitIntoChunks(bytes);
  return {
    name: file.name,
    size: bytes.length,
    hash,
    chunks
  };
}