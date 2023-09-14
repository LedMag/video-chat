const ACTIONS = {
    MESSAGE: 'message',
    JOIN: 'join-room',
    CREATE: 'create-room',
    LEAVE: 'leave-room',
    SHARE_ROOMS: 'share-rooms',
    SHARE_CLIENTS: 'share-clients',
    ADD_PEER: 'add-peer',
    REMOVE_PEER: 'remove-peer',
    ANSWER: 'answer',
    OFFER: 'offer',
    ICE_CANDIDATE: 'ice-candidate',
    SESSION_DESCRIPTION: 'session-description',
    LOGIN: 'login',
    LOGOUT: 'logout'
};
const generateToken = (size) => {
    const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
    const NUMBERS = '0123456789';
    const CHARACTERS = UPPERCASE + LOWERCASE + NUMBERS;
    let token = '';
    for (let i = 0; i < size; i++) {
        const randomIndex = Math.floor(Math.random() * CHARACTERS.length);
        token += CHARACTERS.charAt(randomIndex);
    }
    return token;
};
const createForm = document.getElementById('form');
const devicesForm = document.getElementById('devices');
const videoChk = document.getElementById('videoCheck');
const audioChk = document.getElementById('audioCheck');
const videoUserChk = document.getElementById('videoUserCheck');
const audioUserChk = document.getElementById('audioUserCheck');
const videoInput = document.getElementById('video-input');
const audioInput = document.getElementById('audio-input');
const roomsList = document.getElementById('rooms');
const localVideoFrame = document.getElementById('localVideo');
const remoteVideoFrame = document.getElementById('remoteVideo');
const clientsList = document.getElementById('clients');
const token = generateToken(32);
let socket;
let localStream;
let remoteStream;
let dataChannel;
let tracks;
let audioTracks;
let videoTracks;
let remoteTracks;
let remoteAudioTracks;
let remoteVideoTracks;
let audioDeviceId;
let videoDeviceId;
let videoIsOn = true;
let audioIsOn = true;
let remoteVideoIsOn = true;
let remoteAudioIsOn = true;
const DEFAULT_AUDIO_CONSTRAINTS = {
    echoCancellation: true,
    autoGainControl: true,
    noiseSuppression: true
};
const DEFAULT_VIDEO_CONSTRAINTS = {
    width: 1920,
    height: 1080,
    frameRate: 60
};
const STORAGE_KEY = 'user_media_devices';
const enumerateDevices = async () => {
    try {
        // const devices = sessionStorage.getItem(STORAGE_KEY)
        //   ? JSON.parse(sessionStorage.getItem(STORAGE_KEY))
        //   : await navigator.mediaDevices.enumerateDevices()
        // if (!sessionStorage.getItem(STORAGE_KEY)) {
        //   sessionStorage.setItem(STORAGE_KEY, JSON.stringify(devices))
        // }
        return { devices: await navigator.mediaDevices.enumerateDevices() };
    }
    catch (error) {
        return { error };
    }
};
enumerateDevices().then(({ devices }) => {
    renderDevices(devices);
});
const renderDevices = (devices) => {
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
    });
};
devicesForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(devicesForm);
    videoDeviceId = formData.get('video-input');
    audioDeviceId = formData.get('audio-input');
    const constraints = prepareConstraints();
    await startStream(constraints);
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
const prepareConstraints = () => {
    return {
        audio: audioDeviceId && audioIsOn ? { ...DEFAULT_AUDIO_CONSTRAINTS, deviceId: audioDeviceId } : false,
        video: videoDeviceId && videoIsOn ? { ...DEFAULT_VIDEO_CONSTRAINTS, deviceId: videoDeviceId } : false
    };
};
const startStream = async (constraints) => {
    try {
        localStream = await openMediaDevices(constraints);
        localVideoFrame.srcObject = localStream;
        tracks = localStream.getTracks();
        audioTracks = localStream.getAudioTracks();
        videoTracks = localStream.getVideoTracks();
    }
    catch (error) {
        console.error('Error accessing media devices.', error);
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
// remoteVideoFrame.srcObject = remoteStream;
// const createRTC = async (config) => {
//   console.log([token], 'Create RTC')
//   return new RTCPeerConnection(config);
// }
const allUsers = new Map();
const configuration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] };
// let constraints = {
//   video: {
//     width: { min: 640, ideal: 1920, max: 640 },
//     height: { min: 480, ideal: 1080, max: 640 },
//   },
//   audio: false // {'echoCancellation': true}
// }
const peerConnection = new RTCPeerConnection(configuration);
const openMediaDevices = async (constraints) => {
    return navigator.mediaDevices.getUserMedia(constraints);
};
const go = async (userId) => {
    remoteStream = new MediaStream();
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });
    peerConnection.ontrack = async (event) => {
        console.log([token], 'Track Event: ', event.streams[0]);
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
        remoteTracks = remoteStream.getTracks();
        remoteAudioTracks = remoteStream.getAudioTracks();
        remoteVideoTracks = remoteStream.getVideoTracks();
        audioUserChk.checked = remoteAudioIsOn;
        videoUserChk.checked = remoteVideoIsOn;
        remoteVideoFrame.srcObject = remoteStream;
    };
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            const body = {
                from: token,
                to: userId,
                method: ACTIONS.ICE_CANDIDATE,
                message: { candidate: event.candidate }
            };
            console.log([token], 'Send IceCandidate: ', body);
            socket.send(JSON.stringify(body));
        }
    };
};
async function makeCall(userId) {
    console.log([token], 'Call to: ', userId);
    localVideoFrame.srcObject = localStream;
    await go(userId);
    peerConnection.onconnectionstatechange = event => {
        console.log([token], 'Connection State Change Event: ', event);
        if (peerConnection.connectionState === 'connected') {
            console.log([token], `You are connected with user - ${userId}`);
        }
    };
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    const data = {
        method: ACTIONS.OFFER,
        from: token,
        to: userId,
        message: {
            offer
        }
    };
    console.log([token], 'Send Offer: ', data);
    socket.send(JSON.stringify(data));
}
const login = () => {
    console.log([token], 'Login');
    const data = {
        from: token,
        method: ACTIONS.LOGIN,
    };
    socket.send(JSON.stringify(data));
};
const logout = () => {
    console.log([token], 'Logout');
    const body = {
        from: token,
        method: ACTIONS.LOGOUT,
    };
    socket.send(JSON.stringify(body));
};
const setClients = (data) => {
    console.log([token], 'Set Clients: ', data);
    const clients = data.message.clients;
    clientsList.innerHTML = '';
    clients.forEach(client => {
        if (client !== token) {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.setAttribute('data-user', client);
            btn.innerText = `Call to ${client}`;
            btn.addEventListener('click', async (event) => {
                console.log([token], 'Click for call to - ', client);
                const userId = event.target.getAttribute('data-user');
                await makeCall(userId);
            });
            li.appendChild(btn);
            clientsList.appendChild(li);
        }
    });
};
const userLogin = (data) => {
    console.log([token], 'User Login: ', data);
    allUsers.set(data.from, {});
};
const userLogout = (data) => {
    console.log([token], 'User Logout: ', data);
    allUsers.delete(data.from);
};
// const createPeerConnection = async (userId: string, socket: WebSocket) => {
//   peerConnection = new RTCPeerConnection(servers);
//   remoteStream = new MediaStream();
//   remoteVideoFrame.srcObject = remoteStream;
//   remoteVideoFrame.style.display = 'block';
//   document.getElementById('user-1').classList.add('smallFrame')
//   if (!localStream) {
//     localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
//     localVideoFrame.srcObject = localStream
//   }
//   localStream.getTracks().forEach((track) => {
//     peerConnection.addTrack(track, localStream)
//   })
//   peerConnection.ontrack = (event) => {
//     event.streams[0].getTracks().forEach((track) => {
//       remoteStream.addTrack(track)
//     })
//   }
//   peerConnection.onicecandidate = async (event) => {
//     if (event.candidate) {
//       socket.send(JSON.stringify({
//         clientId: token,
//         method: ACTIONS.ICE_CANDIDATE,
//         message: { candidate: event.candidate, userId }
//       }))
//     }
//   }
// }
const setOffer = async (data) => {
    const offer = data.message.offer;
    if (offer && !peerConnection.remoteDescription) {
        console.log([token], 'setOffer', data);
        const remoteDesc = new RTCSessionDescription(offer);
        await peerConnection.setRemoteDescription(remoteDesc);
    }
};
const setAnswer = async (data) => {
    const answer = data.message.answer;
    if (answer && !peerConnection.remoteDescription) {
        console.log([token], 'setAnswer', data);
        const remoteDesc = new RTCSessionDescription(answer);
        await peerConnection.setRemoteDescription(remoteDesc);
    }
};
const answer = async (data) => {
    await setAnswer(data);
};
const offer = async (data) => {
    const userId = data.from;
    localVideoFrame.srcObject = localStream;
    await go(userId);
    await setOffer(data);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(new RTCSessionDescription(answer));
    const body = {
        method: ACTIONS.ANSWER,
        from: token,
        to: userId,
        message: {
            answer
        }
    };
    console.log([token], 'Send Answer', body);
    socket.send(JSON.stringify(body));
};
const addIceCandidate = async (data) => {
    console.log([token], 'Recived IceCandidate', data);
    const candidate = data.message.candidate;
    if (candidate && peerConnection.remoteDescription) {
        try {
            console.log([token], 'Add IceCandidate', data);
            await peerConnection.addIceCandidate(candidate);
        }
        catch (e) {
            console.error([token], 'Error adding received ice candidate', e);
        }
    }
};
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
    [ACTIONS.LOGIN, userLogin],
    [ACTIONS.LOGOUT, userLogout]
]);
const route = (data) => {
    const { method } = data;
    return routing.get(method);
};
(async function init() {
    console.log('Start');
    socket = new WebSocket('ws://192.168.1.135:8080');
    socket.addEventListener('open', (event) => {
        console.log([token], 'Conexión establecida:', event);
        login();
    });
    socket.onmessage = (event) => {
        let data;
        try {
            data = JSON.parse(event.data);
            console.log([token], 'Data: ', data);
            const fn = route(data);
            console.log('Function: ', fn.name, data.method);
            if (fn)
                fn(data);
        }
        catch (error) {
            console.log([token], `Data is not valid`);
        }
    };
    socket.addEventListener('close', (event) => {
        console.log([token], 'Conexión cerrada:', event);
    });
    window.addEventListener("beforeunload", logout);
})();
