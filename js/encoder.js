function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Header packet: H|name|size|hash|payloadSize|gzip|k|blockSize
function buildHeaderPacket(info) {
  return [
    'H',
    encodeURIComponent(info.name),
    info.size,
    info.hash,
    info.payloadSize,
    info.gzip ? 1 : 0,
    info.blocks.length,
    info.blocks[0].length
  ].join('|');
}

// Data packet: D|seed|base64data
function buildDataPacket(seed, encodedBlock) {
  return `D|${seed}|${bytesToBase64(encodedBlock)}`;
}