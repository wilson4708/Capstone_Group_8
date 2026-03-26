/**
 * TeachableScript.js - ML Model Integration
 *
 * Handles:
 * - Loading TensorFlow.js model from Teachable Machine
 * - Webcam setup and frame capture
 * - Button-triggered image classification
 * - Confidence score and lighting display
 *
 * API Documentation:
 * https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image
 */

// ========== Configuration ==========
const CONFIG = {
  MODEL_URL: "./ModelFiles/",
};

// ========== Global State ==========
let model, webcam, labelContainer, maxPredictions;
let lastLightingCheck = 0;
let useUploadedImage = false;
let uploadedImageElement = null;
let isRunning = false;
let currentFacingMode = "user"; // Start with front camera

// ========== Initialization ==========

/**
 * Loads the ML model and starts either webcam or uploaded-image mode.
 * @throws {Error} If model loading or camera access fails
 */
async function init() {
  try {
    model = await tmImage.load(
      CONFIG.MODEL_URL + "model.json",
      CONFIG.MODEL_URL + "metadata.json"
    );
    maxPredictions = model.getTotalClasses();
    isRunning = true;

    if (window.uploadedImageData) {
      // Uploaded image mode: load the image and run one prediction
      useUploadedImage = true;
      uploadedImageElement = new Image();
      uploadedImageElement.src = window.uploadedImageData;

      await new Promise((resolve, reject) => {
        uploadedImageElement.onload = resolve;
        uploadedImageElement.onerror = reject;
      });

      document.getElementById("webcam-container").appendChild(uploadedImageElement);
      labelContainer = document.getElementById("label-container");
      await predict();
    } else {
      // Webcam mode: start live preview and lighting checks
      useUploadedImage = false;
      await startWebcam();
      window.requestAnimationFrame(loop);

      labelContainer = document.getElementById("label-container");

      const flipBtn = document.getElementById("FlipCamBtn");
      if (flipBtn) flipBtn.style.display = "inline-block";
    }
  } catch (error) {
    console.error("Initialization error:", error);
    alert("Failed to initialize. Please check camera permissions and internet connection.");

    const startBtn = document.getElementById("StartCamBtn");
    if (startBtn) {
      startBtn.style.display = "inline-block";
      startBtn.disabled = false;
      startBtn.textContent = "Start Camera Feed";
    }

    throw error;
  }
}

// ========== Camera Setup ==========

/**
 * Starts the webcam using getUserMedia with the current facing mode.
 * Builds a proxy object with canvas + update() to match the rest of the code.
 * getUserMedia is used directly (instead of tmImage.Webcam) so we can control
 * facingMode — the Teachable Machine library hardcodes it to "user".
 */
async function startWebcam() {
  const container = document.getElementById("webcam-container");

  // Stop and remove any existing stream
  if (webcam && webcam._videoEl) {
    const oldStream = webcam._videoEl.srcObject;
    if (oldStream) oldStream.getTracks().forEach((t) => t.stop());
    webcam._videoEl.remove();
  }
  container.innerHTML = "";

  // iOS Safari requires { exact: "environment" } to reliably switch to the back
  // camera — a plain "environment" string is often ignored on iOS.
  const facingConstraint =
    currentFacingMode === "environment" ? { exact: "environment" } : "user";

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: facingConstraint },
    audio: false,
  });

  const video = document.createElement("video");
  video.srcObject = stream;
  video.setAttribute("playsinline", ""); // Required for iOS — prevents fullscreen takeover
  video.muted = true;
  await video.play();

  // Wait for the browser to know the stream's real dimensions
  await new Promise((resolve) => {
    if (video.readyState >= 1) resolve();
    else video.addEventListener("loadedmetadata", resolve, { once: true });
  });

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  // Mirror front camera so it looks natural; back camera should not be mirrored
  canvas.style.transform = currentFacingMode === "user" ? "scaleX(-1)" : "";
  container.appendChild(canvas);

  webcam = {
    _videoEl: video,
    canvas: canvas,
    update() {
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    },
  };
}

/**
 * Toggles between front and rear cameras and restarts the webcam stream.
 */
async function flipCamera() {
  currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
  await startWebcam();
}

// Wire up the Flip Camera button once the DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const flipBtn = document.getElementById("FlipCamBtn");
  if (flipBtn) flipBtn.addEventListener("click", flipCamera);
});

// ========== Animation Loop ==========

/**
 * Keeps the webcam preview updated and refreshes the lighting indicator.
 * Prediction is NOT triggered here — only on Take Photo button press.
 */
function loop() {
  if (!isRunning) return;

  if (!useUploadedImage && webcam) {
    webcam.update();

    // Update lighting ~2x per second to avoid hammering getImageData every frame
    const now = Date.now();
    if (now - lastLightingCheck >= 500) {
      checkLighting();
      lastLightingCheck = now;
    }

    window.requestAnimationFrame(loop);
  }
}

// ========== Prediction ==========

/**
 * Captures the current webcam frame and runs a single prediction.
 * Disables the button while analyzing to prevent double-taps.
 */
async function captureAndPredict() {
  const btn = document.getElementById("TakePhotoBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Scanning...";
  }
  await predict();
  if (btn) {
    btn.disabled = false;
    btn.textContent = "Scan";
  }
}

/**
 * Runs ML prediction on the current webcam frame or uploaded image.
 * Displays a color-coded confidence result:
 *   Green  (≥70%) — high confidence, likely PG
 *   Yellow (40–69%) — uncertain
 *   Red    (<40%)  — low confidence, likely not PG
 */
async function predict() {
  let prediction;

  if (useUploadedImage && uploadedImageElement) {
    prediction = await model.predict(uploadedImageElement);
  } else if (webcam?.canvas) {
    prediction = await model.predict(webcam.canvas);
  } else {
    console.error("No image source available for prediction");
    return;
  }

  // Find the PG class (assumes class name contains "pg")
  let pgPrediction = null;
  for (let i = 0; i < maxPredictions; i++) {
    if (prediction[i].className.toLowerCase().includes("pg")) {
      pgPrediction = prediction[i];
      break;
    }
  }

  labelContainer.innerHTML = "";

  if (pgPrediction) {
    const prob = pgPrediction.probability * 100;
    const resultDiv = document.createElement("div");
    resultDiv.innerHTML = `PG Detected: ${prob.toFixed(1)}%`;

    if (prob >= 70) {
      resultDiv.style.background = "rgba(34, 197, 94, 0.9)";  // Green
    } else if (prob >= 40) {
      resultDiv.style.background = "rgba(234, 179, 8, 0.9)";  // Yellow
    } else {
      resultDiv.style.background = "rgba(239, 68, 68, 0.9)";  // Red
    }

    labelContainer.appendChild(resultDiv);
  }
}

// ========== Lighting Check ==========

/**
 * Samples the webcam canvas to estimate scene brightness and updates
 * the lighting indicator with Good / Too Dark / Too Bright feedback.
 */
function checkLighting() {
  if (!webcam?.canvas) return;

  const ctx = webcam.canvas.getContext("2d");
  const { data } = ctx.getImageData(0, 0, webcam.canvas.width, webcam.canvas.height);

  // Standard luminance formula averaged across all pixels
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const brightness = total / (data.length / 4); // 0–255

  const lightingDiv = document.getElementById("lighting-container");
  if (!lightingDiv) return;

  let label, bg;
  if (brightness >= 80 && brightness <= 200) {
    label = "Lighting: Good";
    bg = "rgba(34, 197, 94, 0.9)";
  } else if (brightness < 80) {
    label = "Lighting: Too Dark";
    bg = "rgba(239, 68, 68, 0.9)";
  } else {
    label = "Lighting: Too Bright";
    bg = "rgba(234, 179, 8, 0.9)";
  }

  lightingDiv.innerHTML = `<div style="
    background: ${bg};
    padding: 12px 24px;
    border-radius: 12px;
    color: white;
    font-weight: bold;
    width: fit-content;
    margin: 0 auto;
    box-shadow: 0 4px 10px rgba(0,0,0,0.7);
  ">${label}</div>`;
}
