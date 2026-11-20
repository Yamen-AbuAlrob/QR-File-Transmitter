const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');

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
});