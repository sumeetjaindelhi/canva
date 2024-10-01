self.onmessage = function(e) {
  const { video, fps } = e.data;
  const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
  const ctx = canvas.getContext('2d');
  
  const frames = [];
  const duration = video.duration;

  for (let i = 0; i < duration; i += 1/fps) {
    video.currentTime = i;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    frames.push(imageData);
  }

  self.postMessage(frames);
};
