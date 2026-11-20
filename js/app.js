const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const qrDisplay = document.getElementById('qrDisplay');
const status = document.getElementById('status');
const startSendBtn = document.getElementById('startSendBtn');
const stopBtn = document.getElementById('stopBtn');

const FRAME_DELAY_MS = 200; // time each QR stays on screen
let playTimer = null;
let packets = [];

function buildAllPackets(result) {
  const total = result.chunks.length;
  const all = [buildHeaderPacket(result, total)];
  result.chunks.forEach((chunk, i) => {
    all.push(buildDataPacket(i, total, chunk));
  });
  return all;
}

// Show only the header packet and wait for the user to confirm
function showHeaderOnly() {
  clearInterval(playTimer);
  renderQr(packets[0], qrDisplay);
  status.textContent = 'Header shown. Wait until the receiver reads it, then press Start Sending.';
  startSendBtn.disabled = false;
  stopBtn.disabled = true;
}

// Loop through the data packets only (index 1 and up)
function startSending() {
  clearInterval(playTimer);
  let index = 1;

  function showNext() {
    renderQr(packets[index], qrDisplay);
    status.textContent = `Chunk ${index} / ${packets.length - 1}`;
    index++;
    if (index >= packets.length) {
      index = 1; // loop back to the first data packet
    }
  }

  showNext();
  playTimer = setInterval(showNext, FRAME_DELAY_MS);
  startSendBtn.disabled = true;
  stopBtn.disabled = false;
}

function stopSending() {
  clearInterval(playTimer);
  showHeaderOnly();
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;

  clearInterval(playTimer);
  fileInfo.textContent = 'Processing...';
  const result = await processFile(file);

  fileInfo.innerHTML = `
    Name: ${result.name}<br>
    Size: ${result.size} bytes<br>
    Chunks: ${result.chunks.length}<br>
    SHA-256: <code>${result.hash}</code>
  `;

  packets = buildAllPackets(result);
  showHeaderOnly();
});

startSendBtn.addEventListener('click', startSending);
stopBtn.addEventListener('click', stopSending);