import AgoraRTC from "agora-rtc-sdk-ng"
import { sendEvent } from "./mixPanel"

let options =
{
  // Pass your App ID here.
  appId: import.meta.env.VITE_APP_APPID,
  // Set the channel name.
  channel: import.meta.env.VITE_APP_CHANNEL,
  // Pass your temp token here.
  token: '',
  // Set the user ID.
  uid: 98765,
  // Set the user role
  role: '',
  optimizationMode: 'detail'
};

let channelParameters =
{
  // A variable to hold a local audio track.
  localAudioTrack: null,
  // A variable to hold a local video track.
  localVideoTrack: null,
  // A variable to hold a remote audio track.
  remoteAudioTrack: null,
  // A variable to hold a remote video track.
  remoteVideoTrack: null,
  // A variable to hold the remote user id.s
  remoteUid: null,
};

let isHighRemoteVideoQuality = false;
let mixPanelTimer = null
let currentFramerate = 20
let videoTimer = null
// Create an instance of the Agora Engine
const agoraEngine = AgoraRTC.createClient({ mode: "rtc", codec: "vp9" });

async function startBasicCall() {

  // Dynamically create a container in the form of a DIV element to play the remote video track.
  const remotePlayerContainer = document.createElement("div");
  // Dynamically create a container in the form of a DIV element to play the local video track.
  const localPlayerContainer = document.createElement('div');
  // Specify the ID of the DIV container. You can use the uid of the local user.
  localPlayerContainer.id = options.uid;
  // Set the textContent property of the local video container to the local user id.
  localPlayerContainer.textContent = "Local user " + options.uid;
  // Set the local video container size.
  localPlayerContainer.style.width = "640px";
  localPlayerContainer.style.height = "480px";
  localPlayerContainer.style.padding = "15px 5px 5px 5px";
  // Set the remote video container size.
  remotePlayerContainer.style.width = "640px";
  remotePlayerContainer.style.height = "480px";
  remotePlayerContainer.style.padding = "15px 5px 5px 5px"; 
  // Listen for the "user-published" event to retrieve a AgoraRTCRemoteUser object.
  agoraEngine.on("user-published", async (user, mediaType) => {
    // Subscribe to the remote user when the SDK triggers the "user-published" event.
    await agoraEngine.subscribe(user, mediaType);
    console.log("subscribe success");
    // Subscribe and play the remote video in the container If the remote user publishes a video track.
    if (mediaType == "video") {
      // Retrieve the remote video track.
      channelParameters.remoteVideoTrack = user.videoTrack;
      // Retrieve the remote audio track.
      channelParameters.remoteAudioTrack = user.audioTrack;
      // Save the remote user id for reuse.
      channelParameters.remoteUid = user.uid.toString();
      // Specify the ID of the DIV container. You can use the uid of the remote user.
      remotePlayerContainer.id = user.uid.toString();
      channelParameters.remoteUid = user.uid.toString();
      remotePlayerContainer.textContent = "Remote user " + user.uid.toString();
      // Append the remote container to the page body.
      document.body.append(remotePlayerContainer);

       // Set a stream fallback option to automatically switch remote video quality when network conditions degrade. 
      // agoraEngine.setStreamFallbackOption(channelParameters.remoteUid, 1);
 
      // Play the remote video track.
      channelParameters.remoteVideoTrack.play(remotePlayerContainer);
    }
    // Subscribe and play the remote audio track If the remote user publishes the audio track only.
    if (mediaType == "audio") {
      // Get the RemoteAudioTrack object in the AgoraRTCRemoteUser object.
      channelParameters.remoteAudioTrack = user.audioTrack;
      // Play the remote audio track. No need to pass any DOM element.
      channelParameters.remoteAudioTrack.play();
    }
    // Listen for the "user-unpublished" event.
    agoraEngine.on("user-unpublished", user => {
      console.log(user.uid + "has left the channel");
    });
    agoraEngine.on("network-quality", async (quality) => {
      console.log(quality.uplinkNetworkQuality, '\nand\n', quality.downlinkNetworkQuality)
      if(quality.uplinkNetworkQuality >= 4 && currentFramerate > 5) {
        currentFramerate = 5
        await channelParameters.localVideoTrack.setEncoderConfiguration({ frameRate: currentFramerate })
      } else if(quality.uplinkNetworkQuality < 4 && currentFramerate <= 5) {
        currentFramerate = 20
        await channelParameters.localVideoTrack.setEncoderConfiguration({ frameRate: currentFramerate })
      }
      console.log("\n\framerate changed!")
    });
  });
  window.onload = function () {
    var urlParams = new URL(location.href).searchParams;
    options.token = urlParams.get("token");
    document.getElementById('token').value = options.token
    document.getElementById('opt-mode').value = options.optimizationMode
    
    // Listen to the Join button click event.
    document.getElementById("join").onclick = async function () {

      options.token = document.getElementById('token').value
      const url = new URL(location);
      url.searchParams.set('token', options.token);
      history.pushState({}, "", url);

      // Join a channel.
      await agoraEngine.join(options.appId, options.channel, options.token, options.uid);
      
      // sendDataToMixPanel()

      // Create a local audio track from the audio sampled by a microphone.
      channelParameters.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({encoderConfig: "high_quality_stereo",});
      // Create a local video track from the video captured by a camera.
      // Set a video profile.
      // channelParameters.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
      channelParameters.localVideoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width: 640,
          // Specify a value range and an ideal value
          height: { 
            max: 500, 
            ideal: 480, 
            min: 400, 
          },
          frameRate: 15, //15
          bitrateMin: 600, bitrateMax: 1000,
        },
        optimizationMode: options.optimizationMode || 'detail'
      });

      // change framerate
      // setFramerateInVideoIntervals()

      // Append the local video container to the page body.
      document.body.append(localPlayerContainer);
      // Publish the local audio and video tracks in the channel.
      await agoraEngine.publish([channelParameters.localAudioTrack, channelParameters.localVideoTrack]);
      // Play the local video track.
      channelParameters.localVideoTrack.play(localPlayerContainer);
      console.log("publish success!");
    }
    // Listen to the Leave button click event.
    document.getElementById('leave').onclick = async function () {
      // Destroy the local audio and video tracks.
      channelParameters?.localAudioTrack?.close();
      channelParameters?.localVideoTrack?.close();
      // Remove the containers you created for the local video and remote video.
      removeVideoDiv(remotePlayerContainer.id);
      removeVideoDiv(localPlayerContainer.id);
      // Leave the channel
      await agoraEngine.leave();
      console.log("You left the channel");
      // Refresh the page for reuse
      window.location.reload();
    }

    document.getElementById('opt-mode').onchange = async function(ev) {
      let mode = ev.target.value
      options.optimizationMode = mode
      if (channelParameters.localVideoTrack != null) {
        await channelParameters.localVideoTrack.setOptimizationMode(mode)
        console.log('Changed Optimization mode')
      }
    }
  }
}

startBasicCall();

// send video meta data to mixpanel
function sendDataToMixPanel (){
  if(mixPanelTimer){
    clearInterval(mixPanelTimer)
  }
  mixPanelTimer=setInterval(() => {

    let remoteAudioStats = client.getRemoteAudioStats();
    let remoteVideoStats = client.getRemoteVideoStats();

    // let localAudioStats = client.getLocalAudioStats();
    // let localVideoStats = client.getLocalVideoStats();
    console.log('remoteVideoStats\n', remoteVideoStats)
    console.log('RTC\n', client.getRTCStats(), client.getRemoteNetworkQuality())
    
    Object.entries(remoteAudioStats).map(([key, value]) => {
      let audioData = { userid: key, local_user: options.uid, ...value }
      sendEvent('VC_HOST_AUDIO_STATS', audioData);
    })

    Object.entries(remoteVideoStats).map(([key, value]) => {
      let videoData = { userid: key, local_user: options.uid, ...value }
      sendEvent('VC_HOST_VIDEO_STATS', videoData);
    })
    
    // sendEvent('HOST_AUDIO_STATS', {...localAudioStats, user: options.uid});
    // sendEvent('HOST_VIDEO_STATS', {...localVideoStats, user: options.uid});
    sendEvent('VC_HOST_AV_STATS', {...client.getRTCStats(), user: options.uid, netowrk: client.getRemoteNetworkQuality()});
    // // sendEvent('remote video stats', remoteVideoStats);
    // // sendEvent('remote audio stats', remoteAudioStats);
    client.on("exception", function(evt) {
      sendEvent('VC_EXCEPTION', {code: evt.code, msg: evt.msg, uid: evt.uid})
      // console.log(evt.code, evt.msg, evt.uid);
    })
  }, 5000);
}


function setFramerateInVideoIntervals(){
  clearInterval(videoTimer)
  videoTimer = setInterval(async () => {
    console.log('changing video track...')
    await channelParameters.localVideoTrack.setEncoderConfiguration({ frameRate: currentFramerate, /* height: currentFramerate == 5 ? 120 : 480, width: currentFramerate === 5 ? 160 : 640 */ })
    currentFramerate = currentFramerate === 5 ? 20 : 5
    console.log('video track changed!')
  }, 15000);
}

// Remove the video stream from the container.
function removeVideoDiv(elementId) {
  console.log("Removing " + elementId + "Div");
  let Div = document.getElementById(elementId);
  if (Div) {
    Div.remove();
  }
};
