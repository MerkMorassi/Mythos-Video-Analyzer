
const MAX_FRAMES = 16;
const FRAME_QUALITY = 0.8; // Jpeg quality

/**
 * Extracts a specified number of frames from a video source.
 * @param videoUrl The URL of the video (can be an object URL for local files).
 * @returns A promise that resolves to an array of base64 encoded frame strings (without the data URL prefix).
 */
export const extractFramesFromVideo = (videoUrl: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous'; // Necessary for loading videos from different origins

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const frames: string[] = [];

    if (!context) {
      return reject(new Error('Could not create canvas context.'));
    }

    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const duration = video.duration;
      if (duration <= 0) {
          return reject(new Error("Video has no duration or is invalid."));
      }

      const interval = duration / MAX_FRAMES;
      let currentTime = 0;
      let capturedFrames = 0;

      const seekAndCapture = () => {
        if (capturedFrames >= MAX_FRAMES || currentTime > duration) {
          video.remove();
          canvas.remove();
          resolve(frames);
          return;
        }
        video.currentTime = currentTime;
      };

      video.addEventListener('seeked', () => {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', FRAME_QUALITY);
        const base64Data = dataUrl.split(',')[1];
        if (base64Data) {
            frames.push(base64Data);
        }
        
        capturedFrames++;
        currentTime += interval;
        seekAndCapture();
      });

      seekAndCapture(); // Start the process
    });
    
    video.addEventListener('error', (e) => {
      let errorMsg = 'Unknown video error.';
      switch (video.error?.code) {
        case 1: errorMsg = 'Video loading aborted.'; break;
        case 2: errorMsg = 'A network error caused video download to fail.'; break;
        case 3: errorMsg = 'Video playback aborted due to corruption or unsupported feature.'; break;
        case 4: errorMsg = 'The video could not be loaded, either because the server or network failed or because the format is not supported. Please check CORS policy for URL.'; break;
      }
      reject(new Error(errorMsg));
    });

    video.src = videoUrl;
    video.load(); // Start loading the video
  });
};
