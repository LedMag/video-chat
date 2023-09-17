const createForm = document.getElementById('form') as HTMLFormElement;
const devicesForm = document.getElementById('devices') as HTMLFormElement;
const videoChk = document.getElementById('videoCheck') as HTMLInputElement;
const audioChk = document.getElementById('audioCheck') as HTMLInputElement;
const videoUserChk = document.getElementById('videoUserCheck') as HTMLInputElement;
const audioUserChk = document.getElementById('audioUserCheck') as HTMLInputElement;

const videoInput = document.getElementById('video-input') as HTMLSelectElement;
const audioInput = document.getElementById('audio-input') as HTMLSelectElement;


const roomsList = document.getElementById('rooms') as HTMLUListElement;
const localVideoFrame = document.getElementById('localVideo') as HTMLVideoElement;
const remoteVideoFrame = document.getElementById('remoteVideo') as HTMLVideoElement;
const clientsList = document.getElementById('clients') as HTMLUListElement;

const isProd = true;

const token = generateToken(64);

let socket: WebSocket;
let localStream: MediaStream;
let remoteStream: MediaStream = new MediaStream();
let dataChannel: RTCDataChannel;
let clients: string[];

let tracks: MediaStreamTrack[];
let audioTracks: MediaStreamTrack[];
let videoTracks: MediaStreamTrack[];

let remoteTracks: MediaStreamTrack[];
let remoteAudioTracks: MediaStreamTrack[];
let remoteVideoTracks: MediaStreamTrack[];

let audioDeviceId: string;
let videoDeviceId: string;

let videoIsOn: boolean = true;
let audioIsOn: boolean = true;

let remoteVideoIsOn: boolean = true;
let remoteAudioIsOn: boolean = true;

const DEFAULT_AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  autoGainControl: true,
  noiseSuppression: true
}

const DEFAULT_VIDEO_CONSTRAINTS = {
  width: 1920,
  height: 1080,
  frameRate: 60
}

const STORAGE_KEY = 'user_media_devices'

const enumerateDevices = async () => {
  try {
    // const devices = sessionStorage.getItem(STORAGE_KEY)
    //   ? JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    //   : await navigator.mediaDevices.enumerateDevices()

    // if (!sessionStorage.getItem(STORAGE_KEY)) {
    //   sessionStorage.setItem(STORAGE_KEY, JSON.stringify(devices))
    // }

    return { devices: await navigator.mediaDevices.enumerateDevices() }
  } catch (error) {
    return { error }
  }
};

enumerateDevices().then(({ devices }) => {
  renderDevices(devices);
});

const renderDevices = (devices: MediaDeviceInfo[]) => {
  console.log('Devices', devices);

  videoChk.checked = !!videoIsOn;
  audioChk.checked = !!audioIsOn;

  devices.forEach(device => {
    if (device.kind === "audioinput") {
      const option = document.createElement('option');
      audioDeviceId = device.deviceId;
      option.value = audioDeviceId;
      option.innerText = device.label;
      audioInput.append(option);
    }

    if (device.kind === "videoinput") {
      const option = document.createElement('option');
      videoDeviceId = device.deviceId;
      option.value = videoDeviceId;
      option.innerText = device.label;
      videoInput.append(option);
    }
  })
}

devicesForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(devicesForm);

  videoDeviceId = formData.get('video-input') as string;
  audioDeviceId = formData.get('audio-input') as string;
});

audioChk.addEventListener('change', async (event) => {
  event.preventDefault();

  audioTracks[0].enabled = !audioTracks[0].enabled;
});

videoChk.addEventListener('change', async (event) => {
  event.preventDefault();

  videoTracks[0].enabled = !videoTracks[0].enabled;
});

audioUserChk.addEventListener('change', async (event) => {
  event.preventDefault();

  remoteAudioTracks[0].enabled = !remoteAudioTracks[0].enabled;
});

videoUserChk.addEventListener('change', async (event) => {
  event.preventDefault();

  remoteVideoTracks[0].enabled = !remoteVideoTracks[0].enabled;
});

const prepareConstraints = (): MediaStreamConstraints => {
  return {
    audio: audioDeviceId && audioIsOn ? { ...DEFAULT_AUDIO_CONSTRAINTS, deviceId: audioDeviceId } : false,
    video: videoDeviceId && videoIsOn ? { ...DEFAULT_VIDEO_CONSTRAINTS, deviceId: videoDeviceId } : false
  }
};

const stopStream = () => {
  if (tracks) {
    tracks.forEach(track => {
      track.stop();
    });
  }

  if (localVideoFrame) {
    localVideoFrame.srcObject = null;
  }

  localStream = null;
  tracks = null;
  audioTracks = null;
  videoTracks = null;
};


const configuration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] };

const peerConnection: RTCPeerConnection = new RTCPeerConnection(configuration);

const startStream = async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia(prepareConstraints());
    localVideoFrame.srcObject = localStream;

    tracks = localStream.getTracks();
    audioTracks = localStream.getAudioTracks();
    videoTracks = localStream.getVideoTracks();
  } catch (error) {
    console.error('Error accessing media devices.', error);
  }

  localStream.getTracks().forEach((track: MediaStreamTrack) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = async (event) => {
    console.log([token], 'Track Event: ', event.streams[0])

    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track)
    })

    remoteTracks = remoteStream.getTracks();
    remoteAudioTracks = remoteStream.getAudioTracks();
    remoteVideoTracks = remoteStream.getVideoTracks();

    audioUserChk.checked = remoteAudioIsOn;
    videoUserChk.checked = remoteVideoIsOn;

    remoteVideoFrame.srcObject = remoteStream;
  };
}

const createOffer = async (data: DataType) => {
  const { from, room } = data;

  peerConnection.onconnectionstatechange = event => {
    console.log([token], 'Connection State Change Event: ', event)
    if (peerConnection.connectionState === 'connected') {
      console.log([token], `You are connected to ${room} room`);
    }
  };

  peerConnection.onicecandidate = event => {
    console.log([token], 'IceCandidate: ', event.candidate);

    if (event.candidate) {
      const body: DataType = {
        from: token,
        to: from,
        action: ACTIONS.ICE_CANDIDATE,
        message: { candidate: event.candidate }
      }
      console.log([token], 'Send IceCandidate: ', body);

      socket.send(JSON.stringify(body));
    }
  };

  peerConnection.onicecandidateerror = error => {
    console.log('ICE error: ', error);
  };

  await startStream();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer).catch(err => {
    console.log('Error during set local description. Error: ', err.message);
  });

  const body: DataType = {
    action: ACTIONS.OFFER,
    from: token,
    room: room,
    message: {
      offer
    }
  }
  console.log([token], 'Send Offer: ', body);

  socket.send(JSON.stringify(body));
}

const login = () => {
  console.log([token], 'Login')

  const data: DataType = {
    from: token,
    action: ACTIONS.LOGIN,
  }
  socket.send(JSON.stringify(data));
}

const logout = () => {
  console.log([token], 'Logout')

  const body: DataType = {
    from: token,
    action: ACTIONS.LOGOUT,
  }
  socket.send(JSON.stringify(body));
}

const setClients = (data: DataType) => {
  console.log([token], 'Set Clients: ', data)

  clients = data.message.clients;

  clientsList.innerHTML = '';

  clients.forEach(client => {
    if (client !== token) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.setAttribute('data-user', client);
      btn.innerText = `Call to Client_${client[3]}`;
      btn.addEventListener('click', async (event: any) => {
        console.log([token], 'Click for call to - ', client);
        const userId = event.target.getAttribute('data-user');
        doOutcommingCall(userId);
      })

      li.appendChild(btn);

      clientsList.appendChild(li);
    }
  });
}

const answer = async (data: DataType) => {
  const answer = data.message.answer;

  if (answer) {
    console.log([token], 'setAnswer', data);

    const remoteDesc = new RTCSessionDescription(answer);
    await peerConnection.setRemoteDescription(remoteDesc)
      .then(() => {
        console.log('Answer was setted correctly')
      })
      .catch(err => {
        console.log('Error during set remote description. Error: ', err.message);
      });
  };
}

const offer = async (data: DataType) => {
  const { from, room } = data;

  const offer = data.message.offer;

  peerConnection.onicecandidate = event => {
    console.log([token], 'IceCandidate: ', event.candidate);

    if (event.candidate) {
      const body: DataType = {
        from: token,
        to: from,
        action: ACTIONS.ICE_CANDIDATE,
        message: { candidate: event.candidate }
      }
      console.log([token], 'Send IceCandidate: ', body);

      socket.send(JSON.stringify(body));
    }
  };

  peerConnection.onicecandidateerror = error => {
    console.log('ICE error: ', error);
  };

  await startStream();

  if (offer) {
    console.log([token], 'setOffer', data);

    const remoteDesc = new RTCSessionDescription(offer);
    await peerConnection.setRemoteDescription(remoteDesc)
      .then(async () => {
        console.log('Offer was setted correctly');
      })
      .catch(err => {
        console.log('Error during set remote description. Error: ', err.message);
      });
  };

  peerConnection.onconnectionstatechange = event => {
    console.log([token], 'Connection State Change Event: ', event)
    if (peerConnection.connectionState === 'connected') {
      console.log([token], `You are connected to ${room} room`);
    }
  };

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer).catch(err => {
    console.log('Error during set local description. Error: ', err.message);
  });

  const body: DataType = {
    action: ACTIONS.ANSWER,
    from: token,
    to: from,
    message: {
      answer
    }
  }
  console.log([token], 'Send Answer: ', body);

  socket.send(JSON.stringify(body));
}

const addIceCandidate = async (data: DataType) => {
  console.log([token], 'Recived IceCandidate', data);

  const candidate: RTCIceCandidateInit = data.message.candidate;

  if (candidate && peerConnection.remoteDescription) {
    try {
      console.log([token], 'Add IceCandidate', data);

      await peerConnection.addIceCandidate(candidate);
    } catch (e) {
      console.error([token], 'Error adding received ice candidate', e);
    }
  }
}

const incommingCall = async (data: DataType) => {
  const userId = data.from;

  console.log(`Incomming Call from Client_${userId[3]}`);

  await createOffer(data);
};

const outcommingCall = () => { };


const routing = new Map([
  [ACTIONS.MESSAGE, console.log],
  [ACTIONS.JOIN, console.log],
  // [ACTIONS.CREATE, call],
  [ACTIONS.LEAVE, console.log],
  [ACTIONS.SHARE_ROOMS, console.log],
  [ACTIONS.SHARE_CLIENTS, setClients],
  [ACTIONS.ADD_PEER, console.log],
  [ACTIONS.REMOVE_PEER, console.log],
  [ACTIONS.ANSWER, answer],
  [ACTIONS.OFFER, offer],
  [ACTIONS.ICE_CANDIDATE, addIceCandidate],
  [ACTIONS.SESSION_DESCRIPTION, console.log],
  [ACTIONS.LOGIN, setClients],
  [ACTIONS.LOGOUT, setClients],
  [ACTIONS.INCOMMING_CALL, incommingCall],
  [ACTIONS.OUTCOMMING_CALL, outcommingCall]
])

const route = (data: DataType) => {
  const { action } = data;

  return routing.get(action);
}

const doOutcommingCall = (to: string) => {
  const data: DataType = {
    from: token,
    to,
    room: 'test123',
    action: ACTIONS.OUTCOMMING_CALL,
    message: `User Client_${token[3]} are calling you`
  }

  socket.send(JSON.stringify(data));
}

(async function init() {
  console.log('Start');

  const url = isProd ? `wss://911531b.online-server.cloud/ws?clientId=${token}` : `ws://localhost:8080/ws?clientId=${token}`;

  console.log('Url: ', url);

  socket = new WebSocket(url);

  socket.addEventListener('open', (event) => {
    console.log([token], 'Conexión establecida:', event);
  });

  socket.onmessage = (event) => {
    let data: DataType;
    try {
      data = JSON.parse(event.data);
      const fn = route(data);
      console.log('Function: ', fn.name, data.action)
      if (fn) fn(data);
    } catch (error) {
      console.log([token], `Data is not valid`)
    }
  };

  socket.addEventListener('close', (event) => {
    console.log([token], 'Conexión cerrada:', event);
  });
})()