function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Header packet: H|name|size|hash|total
function buildHeaderPacket(info, total) {
  return `H|${encodeURIComponent(info.name)}|${info.size}|${info.hash}|${total}`;
}

// Data packet: D|index|total|base64data
function buildDataPacket(index, total, chunk) {
  return `D|${index}|${total}|${bytesToBase64(chunk)}`;
}