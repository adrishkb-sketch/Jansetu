/**
 * Jansetu — Client-side local MediaPipe Object Detection
 */

let detectorInstance: any = null;
let initializingPromise: Promise<any> | null = null;

async function getOrInitDetector() {
  if (detectorInstance) return detectorInstance;
  if (initializingPromise) return initializingPromise;

  initializingPromise = (async () => {
    try {
      // Use dynamic import with vite-ignore to prevent static bundler warnings/errors
      const mpVision = await import(
        /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs" as any
      );
      const { FilesetResolver, ObjectDetector } = mpVision;

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
      );

      detectorInstance = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite"
        },
        scoreThreshold: 0.35, // 35% confidence threshold to keep it relevant
        runningMode: "IMAGE"
      });
      return detectorInstance;
    } catch (err) {
      initializingPromise = null;
      console.error("[Jansetu MediaPipe] Failed to initialize object detector:", err);
      throw err;
    }
  })();

  return initializingPromise;
}

export async function runLocalObjectDetection(imageSrc: string): Promise<any[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = async () => {
      try {
        const detector = await getOrInitDetector();
        const result = detector.detect(img);

        const naturalWidth = img.naturalWidth || img.width || 1;
        const naturalHeight = img.naturalHeight || img.height || 1;

        const boxes = (result.detections || []).map((det: any) => {
          const category = det.categories?.[0];
          const label = category?.categoryName || "Object";
          const score = category?.score || 0;

          const bbox = det.boundingBox;
          if (!bbox) return null;

          // Convert absolute pixels to 0-100 percentage coordinates
          const px = (bbox.originX / naturalWidth) * 100;
          const py = (bbox.originY / naturalHeight) * 100;
          const pw = (bbox.width / naturalWidth) * 100;
          const ph = (bbox.height / naturalHeight) * 100;

          return {
            label,
            x: Math.round(Math.max(0, Math.min(99, px))),
            y: Math.round(Math.max(0, Math.min(99, py))),
            width: Math.round(Math.max(1, Math.min(100 - px, pw))),
            height: Math.round(Math.max(1, Math.min(100 - py, ph))),
            score: Math.round(score * 100)
          };
        }).filter(Boolean);

        resolve(boxes);
      } catch (err) {
        console.error("[Jansetu MediaPipe] Detection failed:", err);
        resolve([]); // Resolve empty array instead of failing, to let the application run gracefully
      }
    };
    img.onerror = (err) => {
      console.error("[Jansetu MediaPipe] Image failed to load:", err);
      resolve([]);
    };
  });
}
