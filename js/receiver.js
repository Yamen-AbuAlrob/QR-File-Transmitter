const startBtn = document.getElementById('startBtn');
const screenBtn = document.getElementById('screenBtn');
const resetBtn = document.getElementById('resetBtn');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const progress = document.getElementById('progress');
const bar = document.getElementById('bar');
const stats = document.getElementById('stats');
const debug = document.getElementById('debug');
const result = document.getElementById('result');

let header = null;      // file info from the header packet
let decoder = null;     // FountainDecoder
let finished = false;
let scanTimer = null;
let scanCount = 0;
let packetCount = 0;    // distinct data packets received
let startTime = null;   // time of the first data packet

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

async function gunzipBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function handlePacket(text) {
  const parts = text.split('|');

  if (parts[0] === 'H' && parts.length === 8) {
    if (header) return; // keep the first header
    header = {
      name: decodeURIComponent(parts[1]),
      size: Number(parts[2]),
      hash: parts[3],
      payloadSize: Number(parts[4]),
      gzip: parts[5] === '1',
      k: Number(parts[6]),
      blockSize: Number(parts[7])
    };
    decoder = new FountainDecoder(header.k, header.blockSize);
    updateProgress();
  } else if (parts[0] === 'D' && parts.length === 3) {
    if (!header) return; // need the header first
    const seed = Number(parts[1]);
    if (decoder.seen.has(seed)) return;

    if (!startTime) startTime = Date.now();
    packetCount++;
    decoder.addPacket(seed, base64ToBytes(parts[2]));
    updateProgress();
    checkComplete();
  }
}

function updateProgress() {
  if (!header) return;

  if (packetCount === 0) {
    progress.textContent =
      `Header received: ${header.name} (${header.size} bytes, ${header.k} blocks). Ready.`;
    bar.value = 0;
    stats.textContent = '';
    return;
  }

  const percent = Math.round((decoder.solvedCount / header.k) * 100);
  const elapsed = (Date.now() - startTime) / 1000;
  const rate = packetCount / Math.max(elapsed, 0.1);
  const expected = Math.ceil(header.k * 1.4);
  const remaining = Math.max(0, Math.ceil((expected - packetCount) / rate));

  progress.textContent = `Solved ${decoder.solvedCount} / ${header.k} blocks (${percent}%)`;
  bar.value = percent;
  stats.textContent =
    `Packets: ${packetCount} | Speed: ${rate.toFixed(1)} packets/s | ` +
    `Estimated time left: ${remaining}s`;
}

async function checkComplete() {
  if (finished || !decoder || !decoder.isComplete()) return;

  finished = true;
  clearInterval(scanTimer);
  progress.textContent = 'All blocks solved. Verifying...';

  // Join the blocks and cut the zero padding
  const joined = new Uint8Array(header.k * header.blockSize);
  decoder.solved.forEach((block, i) => joined.set(block, i * header.blockSize));
  let bytes = joined.slice(0, header.payloadSize);

  if (header.gzip) {
    bytes = await gunzipBytes(bytes);
  }

  const hash = await sha256Hex(bytes);
  if (hash !== header.hash) {
    progress.textContent = 'Hash mismatch. File is corrupted.';
    result.innerHTML = `
      <p>Expected: <code>${header.hash}</code></p>
      <p>Got: <code>${hash}</code></p>
    `;
    return;
  }

  bar.value = 100;
  progress.textContent =
    `Done in ${packetCount} packets. Integrity check passed (SHA-256 matches).`;

  // Give the blob a MIME type so video, audio and GIF play correctly
  const mimeByExt = {
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    m4v: 'video/mp4', '3gp': 'video/3gpp', ogv: 'video/ogg',
    gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
    m4a: 'audio/mp4', aac: 'audio/aac'
  };
  const ext = header.name.split('.').pop().toLowerCase();
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeByExt[ext] || '' }));

  const lowerName = header.name.toLowerCase();
  let preview = '';
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerName)) {
    preview = `<img src="${url}" alt="preview" style="max-width:100%;margin-top:0.5rem">`;
  } else if (/\.(mp4|webm|mov|m4v|3gp|ogv)$/.test(lowerName)) {
    preview = `<video src="${url}" controls autoplay loop muted playsinline style="max-width:100%;margin-top:0.5rem"></video>`;
  } else if (/\.(mp3|wav|ogg|m4a|aac)$/.test(lowerName)) {
    preview = `<audio src="${url}" controls style="width:100%;margin-top:0.5rem"></audio>`;
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

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
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
  scanTimer = setInterval(scanFrame, 100);
}

startBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    video.srcObject = stream;
    await video.play();
    startScanning();
  } catch (err) {
    debug.textContent = `Camera error: ${err.name} - ${err.message}`;
  }
});

screenBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    video.srcObject = stream;
    await video.play();
    startScanning();
  } catch (err) {
    debug.textContent = `Screen error: ${err.name} - ${err.message}`;
  }
});

resetBtn.addEventListener('click', () => {
  clearInterval(scanTimer);
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  header = null;
  decoder = null;
  finished = false;
  scanCount = 0;
  packetCount = 0;
  startTime = null;
  progress.textContent = 'Waiting for header...';
  bar.value = 0;
  stats.textContent = '';
  debug.textContent = '';
  result.innerHTML = '';
});