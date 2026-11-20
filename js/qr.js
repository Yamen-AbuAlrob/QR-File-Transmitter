function renderQr(text, container) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  container.innerHTML = qr.createSvgTag(4, 4);
}