const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const qrDisplay = document.getElementById('qrDisplay');
const status = document.getElementById('status');

const FRAME_DELAY_MS = 500; // time each QR stays on screen
let playTimer = null;

function playChunks(chunks) {
  clearInterval(playTimer);
  let index = 0;

  function showNext() {
    const packet = buildPacket(index, chunks.length, chunks[index]);
    renderQr(packet, qrDisplay);
    status.textContent = `Chunk ${index + 1} / ${chunks.length}`;
    index = (index + 1) % chunks.length;
  }

  showNext();
  playTimer = setInterval(showNext, FRAME_DELAY_MS);
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;

  fileInfo.textContent = 'Processing...';
  const result = await processFile(file);

  fileInfo.innerHTML = `
    Name: ${result.name}<br>
    Size: ${result.size} bytes<br>
    Chunks: ${result.chunks.length}<br>
    SHA-256: <code>${result.hash}</code>
  `;

  playChunks(result.chunks);
});