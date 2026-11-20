const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  fileInfo.textContent = `${file.name} - ${file.size} bytes`;
});