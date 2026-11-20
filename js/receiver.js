const startBtn = document.getElementById('startBtn');
const screenBtn = document.getElementById('screenBtn');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const progress = document.getElementById('progress');
const debug = document.getElementById('debug');
const result = document.getElementById('result');

let header = null;        // { name, size, hash, total }
let chunks = new Map();   // index -> Uint8Array
let finished = false;
let scanTimer = null;
let scanCount = 0;

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256Hex(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function handlePacket(text) {
  const parts = text.split('|');

  if (parts[0] === 'H' && parts.length === 5) {
    // Header packet: always fill in the file info
    header = {
      name: decodeURIComponent(parts[1]),
      size: Number(parts[2]),
      hash: parts[3],
      total: Number(parts[4])
    };
  } else if (parts[0] === 'D' && parts.length === 4) {
    const index = Number(parts[1]);
    const total = Number(parts[2]);
    if (!chunks.has(index)) {
      chunks.set(index, base64ToBytes(parts[3]));
    }
    // Data packet seen before the header: remember the total for now
    if (!header) {
      header = { name: null, size: null, hash: null, total };
    }
  } else {
    return; // unknown format, ignore
  }

  updateProgress();
  checkComplete();
}

function updateProgress() {
  if (!header) return;
  if (header.hash && chunks.size === 0) {
    progress.textContent = `Header received: ${header.name} (${header.size} bytes, ${header.total} chunks). Ready.`;
    return;
  }
  const waiting = header.hash ? '' : ' (waiting for header packet)';
  progress.textContent = `Received ${chunks.size} / ${header.total} chunks${waiting}`;
}

async function checkComplete() {
  if (finished || !header || chunks.size < header.total) return;
  if (!header.hash) return; // still waiting for the header packet

  finished = true;
  clearInterval(scanTimer);
  progress.textContent = 'All chunks received. Verifying...';

  // Reassemble in order
  const ordered = [];
  for (let i = 0; i < header.total; i++) {
    ordered.push(chunks.get(i));
  }
  const blob = new Blob(ordered);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const hash = await sha256Hex(bytes);

  if (hash !== header.hash) {
    progress.textContent = 'Hash mismatch. File is corrupted.';
    result.innerHTML = `
      <p>Expected: <code>${header.hash}</code></p>
      <p>Got: <code>${hash}</code></p>
    `;
    return;
  }

  const url = URL.createObjectURL(blob);
  progress.textContent = 'Done. Integrity check passed (SHA-256 matches).';

  let preview = '';
  if (/\.(png|jpe?g|gif|webp)$/i.test(header.name)) {
    preview = `<img src="${url}" alt="preview" style="max-width:100%;margin-top:0.5rem">`;
  }

  result.innerHTML = `
    <p><a id="downloadLink" href="${url}" download="${header.name}">Download ${header.name}</a></p>
    ${preview}
  `;
  document.getElementById('downloadLink').click(); // auto download
}

function scanFrame() {
  if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
  if (!video.videoWidth) return;

    const scale = 1;
  canvas.width = Math.floor(video.videoWidth * scale);
  canvas.height = Math.floor(video.videoHeight * scale);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(img.data, img.width, img.height, {
    inversionAttempts: 'dontInvert'
  });

  scanCount++;
  debug.textContent =
    `Video: ${video.videoWidth}x${video.videoHeight} | ` +
    `Scans: ${scanCount} | QR found: ${code ? 'yes' : 'no'}`;

  if (code && code.data) {
    handlePacket(code.data);
  }
}

function startScanning() {
  clearInterval(scanTimer);
  scanTimer = setInterval(scanFrame, 50);
}

startBtn.addEventListener('click', async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' }
  });
  video.srcObject = stream;
  await video.play();
  startScanning();
});

screenBtn.addEventListener('click', async () => {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  video.srcObject = stream;
  await video.play();
  startScanning();
});

const resetBtn = document.getElementById('resetBtn');

resetBtn.addEventListener('click', () => {
  clearInterval(scanTimer);
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  header = null;
  chunks = new Map();
  finished = false;
  scanCount = 0;
  progress.textContent = 'Waiting for header...';
  debug.textContent = '';
  result.innerHTML = '';
});