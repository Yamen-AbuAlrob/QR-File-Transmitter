function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function buildPacket(index, total, chunk) {
  return `${index}|${total}|${bytesToBase64(chunk)}`;
}