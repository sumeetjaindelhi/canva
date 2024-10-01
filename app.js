// Import necessary Firebase services
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js';
import { getDatabase, ref, onValue, set, push } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js';


const firebaseConfig = {
  apiKey: "AI",
  authDomain: "canv",
  projectId: "ca",
  storageBucket: "canv",
  databaseURL: "https:",
  messagingSenderId: "981128461749",
  appId: "1",
  measurementId: "G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const storage = getStorage(app);

let canvas;
let currentUser;
let currentProjectId;

// User Authentication
const provider = new GoogleAuthProvider();

// Custom Fabric.js Video Object
fabric.Video = fabric.util.createClass(fabric.Image, {
  type: 'video',
  initialize: function(video, options) {
    options || (options = {});
    this.callSuper('initialize', video, options);
    this.video = video;
  },
  _render: function(ctx) {
    if (this.video.readyState > 1) {
      ctx.scale(this.flipX ? -1 : 1, this.flipY ? -1 : 1);
      ctx.drawImage(this.video, -this.width / 2, -this.height / 2, this.width, this.height);
      ctx.scale(this.flipX ? -1 : 1, this.flipY ? -1 : 1);
    }
  }
});

function initializeCanvas() {
  canvas = new fabric.Canvas('canvas', {
    width: 900,
    height: 600
  });

  document.getElementById('addImage').addEventListener('click', addImage);
  document.getElementById('addVideo').addEventListener('click', addVideo);
  document.getElementById('addText').addEventListener('click', addText);
  document.getElementById('applyFilter').addEventListener('click', applyFilter);
  document.getElementById('uploadAsset').addEventListener('change', uploadAsset);
  document.getElementById('save').addEventListener('click', saveProject);

  listenForChanges();
}

// Add Image
function addImage() {
  fabric.Image.fromURL('https://via.placeholder.com/150', (img) => {
    canvas.add(img);
    canvas.renderAll();
    saveChanges();
  });
}

// Add Video
function addVideo() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';

  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.crossOrigin = 'anonymous';
    video.muted = true; // Mute to allow autoplay
    video.autoplay = true;
    video.loop = true;

    video.onloadedmetadata = () => {
      console.log('Video metadata loaded. Dimensions:', video.videoWidth, 'x', video.videoHeight);
      const aspectRatio = video.videoWidth / video.videoHeight;
      let width = Math.min(200, canvas.width - 100);
      let height = width / aspectRatio;

      if (height > canvas.height - 100) {
        height = canvas.height - 100;
        width = height * aspectRatio;
      }

      console.log('Calculated dimensions for fabric object:', width, 'x', height);

      const videoObject = new fabric.Video(video, {
        left: 50,
        top: 50,
        width: width,
        height: height,
        objectCaching: false,
        lockUniScaling: true
      });

      canvas.add(videoObject);
      canvas.setActiveObject(videoObject);
      canvas.renderAll();
      saveChanges();

      // Ensure the video keeps playing and updating
      function updateVideo() {
        videoObject.dirty = true;
        canvas.renderAll();
        fabric.util.requestAnimFrame(updateVideo);
      }
      updateVideo();

      // Toggle play/pause on click
      videoObject.on('mousedown', function () {
        if (video.paused) {
          video.play();
        } else {
          video.pause();
        }
      });
    };

    video.onerror = (e) => {
      console.error('Error loading video:', e);
    };

    // Start loading the video
    video.load();
  };

  input.click();
}

// Add Text
function addText() {
  const text = new fabric.IText('Your text here', {
    left: 50,
    top: 50,
    fontFamily: 'Arial',
    fill: '#000000',
    fontSize: 20
  });
  canvas.add(text);
  canvas.renderAll();
  saveChanges();
}

// Apply Filter (Grayscale)
function applyFilter() {
  const activeObject = canvas.getActiveObject();
  if (activeObject) {
    activeObject.filters.push(new fabric.Image.filters.Grayscale());
    activeObject.applyFilters();
    canvas.renderAll();
    saveChanges();
  }
}

async function uploadAsset(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const assetRef = storageRef(storage, `assets/${currentUser.uid}/${file.name}`);
    await uploadBytes(assetRef, file);
    const downloadURL = await getDownloadURL(assetRef);

    if (file.type.startsWith('image/')) {
      fabric.Image.fromURL(downloadURL, (img) => {
        canvas.add(img);
        canvas.renderAll();
        saveChanges();
      });
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = downloadURL;
      video.crossOrigin = 'anonymous';
      video.muted = false;
      video.autoplay = true;
      video.loop = true;

      video.onloadedmetadata = () => {
        const aspectRatio = video.videoWidth / video.videoHeight;
        let width = Math.min(200, canvas.width - 100);
        let height = width / aspectRatio;

        if (height > canvas.height - 100) {
          height = canvas.height - 100;
          width = height * aspectRatio;
        }

        const videoObject = new fabric.Video(video, {
          left: 50,
          top: 50,
          width: width,
          height: height,
          objectCaching: false,
          lockUniScaling: true
        });

        canvas.add(videoObject);
        canvas.renderAll();
        saveChanges();
      };

      video.addEventListener('error', (e) => {
        console.error('Error loading video:', e);
      });
    }
  } catch (error) {
    console.error('Error uploading asset:', error);
  }
}




async function saveProject() {
  if (!currentUser) return;

  try {
    // Group all objects
    const objects = canvas.getObjects();
    const group = new fabric.Group(objects);

    // Clear the canvas and add the group
    canvas.clear();
    canvas.add(group);
    canvas.renderAll();

    console.log('Objects grouped on canvas:', group);

    // Set up MediaRecorder
    const stream = canvas.getElement().captureStream(30); // 30 fps
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
    const chunks = [];

    // Create a promise to handle the recording process
    const recordingPromise = new Promise((resolve, reject) => {
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      mediaRecorder.onerror = reject;
    });

    // Function to continuously render the canvas
    let isRecording = true;
    function renderCanvas() {
      if (isRecording) {
        canvas.renderAll();
        requestAnimationFrame(renderCanvas);
      }
    }

    // Start rendering the canvas
    renderCanvas();

    // Start recording
    mediaRecorder.start();

    // Record for 5 seconds (adjust as needed)
    await new Promise(resolve => setTimeout(resolve, 5000));
    mediaRecorder.stop();

    // Stop rendering the canvas
    isRecording = false;

    // Wait for the recording to finish
    const videoBlob = await recordingPromise;

    // Upload the video Blob to Firebase Storage
    const videoRef = storageRef(storage, `project_videos/${currentUser.uid}/${Date.now()}.webm`);
    await uploadBytes(videoRef, videoBlob);

    // Get the download URL for the uploaded video
    const downloadURL = await getDownloadURL(videoRef);

    console.log('Project video uploaded successfully!');

    // Save the project data (including video URL and group data)
    const projectData = {
      version: "1.0",
      videoURL: downloadURL,
      groupData: group.toObject(),
      createdAt: new Date().toISOString()
    };

    // Save the project data to Firebase Realtime Database
    await saveProjectToFirebase(projectData);

    console.log('Project saved successfully!');

    // Clear the canvas and reset it to its original state
    canvas.clear();
    canvas.add(...objects);
    canvas.renderAll();

  } catch (error) {
    console.error('Error saving project:', error);
  }
}

async function saveProjectToFirebase(projectData) {
  if (!currentProjectId) {
    const newProjectRef = push(ref(database, `projects/${currentUser.uid}`));
    currentProjectId = newProjectRef.key;
  }
  try {
    await set(ref(database, `projects/${currentUser.uid}/${currentProjectId}`), projectData);
    console.log('Project data saved to Firebase successfully');
  } catch (error) {
    console.error('Error saving to Firebase:', error);
  }
}



// Save changes
function saveChanges() {
  if (currentUser && currentProjectId) {
    saveProject();
  }
}

// Listen for changes
function listenForChanges() {
  canvas.on('object:modified', saveChanges);
  canvas.on('object:added', saveChanges);
  canvas.on('object:removed', saveChanges);
}

// Event Listeners
document.getElementById('login').addEventListener('click', () => {
  signInWithPopup(auth, provider)
    .then((result) => {
      currentUser = result.user;
      console.log('User logged in:', currentUser);
    }).catch((error) => {
      console.error('Login error:', error);
    });
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('editor').style.display = 'block';
    document.getElementById('auth').style.display = 'none';
    initializeCanvas();
  } else {
    document.getElementById('editor').style.display = 'none';
    document.getElementById('auth').style.display = 'block';
  }
});

