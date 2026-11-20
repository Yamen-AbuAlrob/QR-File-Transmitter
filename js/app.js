const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const qrDisplay = document.getElementById('qrDisplay');
const status = document.getElementById('status');
const startSendBtn = document.getElementById('startSendBtn');
const stopBtn = document.getElementById('stopBtn');
const sendEta = document.getElementById('sendEta');

const FRAME_DELAY_MS = 200; // time each QR stays on screen
let playTimer = null;
let fileData = null;      // result of processFile
let degreeTable = null;
let headerPacket = '';

// Show only the header packet and wait for the user to confirm
function showHeaderOnly() {
  clearInterval(playTimer);
  renderQr(headerPacket, qrDisplay);
  status.textContent = 'Header shown. Wait until the receiver reads it, then press Start Sending.';
  startSendBtn.disabled = false;
  stopBtn.disabled = true;
}

// Send an endless stream of encoded packets, each with a new seed
function startSending() {
  clearInterval(playTimer);
  let seed = 1;
  const k = fileData.blocks.length;

  function showNext() {
    const encoded = encodeBlock(fileData.blocks, seed, degreeTable);
    renderQr(buildDataPacket(seed, encoded), qrDisplay);
    status.textContent = `Packet #${seed} (file needs about ${Math.ceil(k * 1.4)} packets)`;
    seed++;
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
  fileData = await processFile(file);

  const k = fileData.blocks.length;
  degreeTable = buildDegreeTable(k);
  headerPacket = buildHeaderPacket(fileData);

  const packetsNeeded = Math.ceil(k * 1.4);
  const seconds = Math.ceil((packetsNeeded * FRAME_DELAY_MS) / 1000);

  fileInfo.innerHTML = `
    Name: ${fileData.name}<br>
    Original size: ${fileData.size} bytes<br>
    Sent size: ${fileData.payloadSize} bytes (${fileData.gzip ? 'gzip compressed' : 'not compressed'})<br>
    Blocks: ${k}<br>
    SHA-256: <code>${fileData.hash}</code>
  `;
  sendEta.textContent = `Estimated sending time: about ${seconds} seconds`;

  showHeaderOnly();
});

startSendBtn.addEventListener('click', startSending);
stopBtn.addEventListener('click', stopSending);