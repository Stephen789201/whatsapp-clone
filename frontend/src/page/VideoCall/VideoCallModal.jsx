"use client"

import { useEffect, useRef, useMemo, useCallback } from "react"
import { FaVideo, FaVideoSlash, FaMicrophone, FaMicrophoneSlash, FaPhoneSlash, FaTimes } from "react-icons/fa"
import useVideoCallStore from "../../store/videoCallStore"
import useUserStore from "../../store/useUserStore"
import useThemeStore from "../../store/themeStore"

const VideoCallModal = ({ socket }) => {
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const pcRef = useRef(null) // Use ref for stable signaling
  const pendingOfferRef = useRef(null) // Queue offer if it arrives too early
  const localIceQueueRef = useRef([]) // Local queue to bypass store delays

  const {
    currentCall,
    incomingCall,
    isCallActive,
    callType,
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    callStatus,
    isCallModalOpen,
    toggleVideo,
    toggleAudio,
    endCall,
    setLocalStream,
    setRemoteStream,
    setPeerConnection,
    setCallStatus,
    setCallActive,
    clearIncomingCall,
    setCurrentCall,
    setCallModalOpen,
  } = useVideoCallStore()

  const { user } = useUserStore()
  const { theme } = useThemeStore()

  const rtcConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  }

  // Camera cleanup fail-safe
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [localStream]);

  // Handle modal closure cleanup
  useEffect(() => {
    if (!isCallModalOpen && !incomingCall && callStatus === "idle") {
      if (localStream) {
        console.log("Cleanup: Stopping tracks because modal is idle");
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
    }
  }, [isCallModalOpen, incomingCall, callStatus, localStream, setLocalStream]);

  // Memoize display info - REACTIVE VERSION
  const displayInfo = useMemo(() => {
    if (incomingCall && !isCallActive) {
      return {
        name: incomingCall.callerName,
        avatar: incomingCall.callerAvatar,
      }
    } else if (currentCall) {
      return {
        name: currentCall.participantName,
        avatar: currentCall.participantAvatar,
      }
    }
    return { name: "Talkies User", avatar: null }
  }, [incomingCall, currentCall, isCallActive])

  // Connection detection
  useEffect(() => {
    if (pcRef.current && remoteStream) {
      console.log("Connected: Remote stream active")
      setCallStatus("connected")
      setCallActive(true)
    }
  }, [remoteStream, setCallStatus, setCallActive])

  // Video Assignments & Deep Sync Watchdog
  useEffect(() => {
    const checkTrackHealth = (stream) => {
      if (!stream) return false;
      const tracks = stream.getTracks();
      return tracks.length > 0 && tracks.every(t => t.readyState === 'live' && t.enabled);
    };

    const updateVideos = () => {
      // Local Video Health Check
      if (localStream && localVideoRef.current) {
        const isHealthy = checkTrackHealth(localStream);
        if (localVideoRef.current.srcObject !== localStream) {
          localVideoRef.current.srcObject = localStream;
        }
        if (localVideoRef.current.paused || !isHealthy) {
          localVideoRef.current.play().catch(() => {});
        }
      }

      // Remote Video Health Check
      if (remoteStream && remoteVideoRef.current) {
        const isHealthy = checkTrackHealth(remoteStream);
        if (remoteVideoRef.current.srcObject !== remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        if (remoteVideoRef.current.paused || !isHealthy) {
          remoteVideoRef.current.play().catch(() => {});
        }
      }
    };

    updateVideos();
    const interval = setInterval(updateVideos, 1500); // More frequent checks
    return () => clearInterval(interval);
  }, [localStream, remoteStream, callStatus]);

  // Initialize Media
  const initializeMedia = useCallback(async (video = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 640, height: 480 } : false,
        audio: true,
      })
      setLocalStream(stream)
      return stream
    } catch (error) {
      console.error("Media error:", error)
      throw error
    }
  }, [setLocalStream])

  // Process local ICE queue
  const processLocalIceQueue = useCallback(async (pc) => {
    if (!pc || !pc.remoteDescription) return;
    
    console.log(`Processing ${localIceQueueRef.current.length} queued ICE candidates`);
    while (localIceQueueRef.current.length > 0) {
      const candidate = localIceQueueRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("ICE addition error:", e);
      }
    }
  }, []);

  // Handle end call
  const handleEndCall = useCallback(() => {
    const state = useVideoCallStore.getState()
    const participantId = state.currentCall?.participantId || state.incomingCall?.callerId
    const callId = state.currentCall?.callId || state.incomingCall?.callId

    if (participantId && callId) {
      socket.emit("end_call", { callId, participantId })
    }
    
    pcRef.current = null
    localIceQueueRef.current = []
    pendingOfferRef.current = null
    endCall()
  }, [socket, endCall])

  // Receive offer (RECEIVER)
  const handleWebRTCOffer = useCallback(async (data) => {
    const { offer, senderId, callId } = data
    console.log("RECEIVER: Received WebRTC offer")
    const pc = pcRef.current

    if (!pc) {
      console.warn("RECEIVER: PC not ready, queuing offer...")
      pendingOfferRef.current = data
      return
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      await processLocalIceQueue(pc)

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      socket.emit("webrtc_answer", {
        answer,
        receiverId: senderId,
        callId,
      })
    } catch (error) {
      console.error("RECEIVER offer error:", error)
    }
  }, [socket, processLocalIceQueue])

  // Create peer connection
  const createPeerConnection = useCallback((stream, role) => {
    const pc = new RTCPeerConnection(rtcConfiguration)
    pcRef.current = pc

    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        const state = useVideoCallStore.getState()
        const participantId = state.currentCall?.participantId || state.incomingCall?.callerId
        const callId = state.currentCall?.callId || state.incomingCall?.callId

        if (participantId && callId) {
          socket.emit("webrtc_ice_candidate", {
            candidate: event.candidate,
            receiverId: participantId,
            callId: callId,
          })
        }
      }
    }

    pc.ontrack = (event) => {
      console.log("Remote track received:", event.track.kind)
      
      // Create a new MediaStream instance combining all receiver tracks.
      // This forces React to recognize the stream reference change and re-bind/re-play the media element.
      const newStream = new MediaStream()
      pc.getReceivers().forEach(receiver => {
        if (receiver.track) {
          newStream.addTrack(receiver.track)
        }
      })
      
      // Fallback: use event stream tracks if receivers are empty
      if (newStream.getTracks().length === 0 && event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach(track => {
          newStream.addTrack(track)
        })
      }
      
      setRemoteStream(newStream)
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        setCallStatus("failed")
        setTimeout(handleEndCall, 2000)
      }
    }

    setPeerConnection(pc)

    if (pendingOfferRef.current && role === "RECEIVER") {
      handleWebRTCOffer(pendingOfferRef.current)
      pendingOfferRef.current = null
    }

    return pc
  }, [socket, setRemoteStream, setCallStatus, setPeerConnection, handleEndCall, handleWebRTCOffer])

  // CALLER: Initialize call
  const initializeCallerCall = useCallback(async () => {
    try {
      setCallStatus("connecting")
      const stream = await initializeMedia(callType === "video")
      const pc = createPeerConnection(stream, "CALLER")

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === "video",
      })

      await pc.setLocalDescription(offer)

      const state = useVideoCallStore.getState()
      socket.emit("webrtc_offer", {
        offer,
        receiverId: state.currentCall.participantId,
        callId: state.currentCall.callId,
      })
    } catch (error) {
      console.error("CALLER error:", error)
      handleEndCall()
    }
  }, [callType, initializeMedia, createPeerConnection, socket, setCallStatus, handleEndCall])

  // RECEIVER: Answer call
  const handleAnswerCall = useCallback(async () => {
    try {
      setCallStatus("connecting")
      const incoming = useVideoCallStore.getState().incomingCall;
      
      if (!incoming) return;

      const stream = await initializeMedia(incoming.callType === "video")
      createPeerConnection(stream, "RECEIVER")

      socket.emit("accept_call", {
        callerId: incoming.callerId,
        callId: incoming.callId,
        receiverInfo: { username: user.username, profilePicture: user.profilePicture },
      })

      // Update state in one batch if possible
      setCurrentCall({
        callId: incoming.callId,
        participantId: incoming.callerId,
        participantName: incoming.callerName,
        participantAvatar: incomingCall?.callerAvatar,
      })
      
      clearIncomingCall()
      setCallModalOpen(true)
    } catch (error) {
      console.error("RECEIVER error:", error)
      handleEndCall()
    }
  }, [user, initializeMedia, createPeerConnection, socket, setCallStatus, setCurrentCall, clearIncomingCall, setCallModalOpen, handleEndCall, incomingCall?.callerAvatar])

  // Handle reject call
  const handleRejectCall = useCallback(() => {
    const incoming = useVideoCallStore.getState().incomingCall;
    if (incoming) {
      socket.emit("reject_call", { callerId: incoming.callerId, callId: incoming.callId })
    }
    endCall()
  }, [socket, endCall])

  // Call accepted
  const handleCallAccepted = useCallback(({ receiverName }) => {
    console.log("✅ Call accepted")
    setTimeout(() => {
      if (useVideoCallStore.getState().currentCall) initializeCallerCall()
    }, 500)
  }, [initializeCallerCall])

  // Call rejected/ended
  const handleCallRejected = useCallback(() => {
    setCallStatus("rejected")
    setTimeout(handleEndCall, 2000)
  }, [setCallStatus, handleEndCall])

  const handleCallEnded = useCallback(() => handleEndCall(), [handleEndCall])

  // Receive answer (CALLER)
  const handleWebRTCAnswer = useCallback(async ({ answer, senderId, callId }) => {
    const pc = pcRef.current
    if (!pc) return

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
      await processLocalIceQueue(pc)
    } catch (error) {
      console.error("CALLER answer error:", error)
    }
  }, [processLocalIceQueue])

  // Receive ICE candidate
  const handleWebRTCIceCandidate = useCallback(async ({ candidate }) => {
    const pc = pcRef.current
    if (pc && pc.remoteDescription && pc.signalingState !== "closed") {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (e) { console.error(e) }
    } else {
      localIceQueueRef.current.push(candidate)
    }
  }, [])

  // Socket Listeners
  useEffect(() => {
    if (!socket) return
    socket.on("call_accepted", handleCallAccepted)
    socket.on("call_rejected", handleCallRejected)
    socket.on("call_ended", handleCallEnded)
    socket.on("webrtc_offer", handleWebRTCOffer)
    socket.on("webrtc_answer", handleWebRTCAnswer)
    socket.on("webrtc_ice_candidate", handleWebRTCIceCandidate)

    return () => {
      socket.off("call_accepted", handleCallAccepted)
      socket.off("call_rejected", handleCallRejected)
      socket.off("call_ended", handleCallEnded)
      socket.off("webrtc_offer", handleWebRTCOffer)
      socket.off("webrtc_answer", handleWebRTCAnswer)
      socket.off("webrtc_ice_candidate", handleWebRTCIceCandidate)
    }
  }, [socket, handleCallAccepted, handleCallRejected, handleCallEnded, handleWebRTCOffer, handleWebRTCAnswer, handleWebRTCIceCandidate])

  // Visibility Gate - FIXED
  if (!isCallModalOpen && !incomingCall && callStatus === "idle") return null

  const shouldShowActiveCall = isCallActive || callStatus === "calling" || callStatus === "connecting" || callStatus === "connected"

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0b141a] animate-in fade-in duration-300">
      <div className="relative w-full h-full flex flex-col overflow-hidden">
        
        {/* Incoming Call UI - WhatsApp Style */}
        {incomingCall && !isCallActive && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-between py-20 bg-[#0b141a]">
            {/* Background Blur Avatar */}
            <div className="absolute inset-0 opacity-20 scale-110 blur-3xl overflow-hidden pointer-events-none">
              <img 
                src={displayInfo?.avatar || "/placeholder.svg"} 
                className="w-full h-full object-cover" 
                alt="" 
              />
            </div>

            <div className="relative z-10 text-center">
              <div className="w-32 h-32 rounded-full border-4 border-[#00a884] p-1 mx-auto mb-6 overflow-hidden shadow-2xl">
                <img
                  src={displayInfo?.avatar || "/placeholder.svg?height=128&width=128"}
                  alt={displayInfo?.name || "Unknown"}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                {displayInfo?.name || "Unknown"}
              </h2>
              <p className="text-[#8696a0] text-lg font-medium animate-pulse">
                Talkies {callType === 'video' ? 'Video' : 'Voice'} Call...
              </p>
            </div>

            <div className="relative z-10 flex space-x-12">
              <div className="flex flex-col items-center space-y-3">
                <button
                  onClick={handleRejectCall}
                  className="w-16 h-16 bg-[#ea0038] hover:bg-[#ff1a4d] rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-110 active:scale-95"
                >
                  <FaPhoneSlash className="w-7 h-7" />
                </button>
                <span className="text-white text-sm font-medium">Decline</span>
              </div>
              
              <div className="flex flex-col items-center space-y-3">
                <button
                  onClick={handleAnswerCall}
                  className="w-16 h-16 bg-[#00a884] hover:bg-[#00c99e] rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-110 active:scale-95"
                >
                  {callType === 'video' ? <FaVideo className="w-7 h-7" /> : <FaMicrophone className="w-7 h-7" />}
                </button>
                <span className="text-white text-sm font-medium">Accept</span>
              </div>
            </div>
          </div>
        )}

        {/* Active Call UI - Immersive Full Screen */}
        {shouldShowActiveCall && (
          <div className="relative w-full h-full bg-[#0b141a]">
            
            {/* Remote Video (Full Screen) */}
            <div className="absolute inset-0 w-full h-full bg-black">
              {/* Remote Media Element (always render if remoteStream exists to play audio/video) */}
              {remoteStream && (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  onLoadedMetadata={(e) => {
                    console.log("Remote play triggered");
                    e.target.play().catch(console.error);
                  }}
                  className={`w-full h-full object-cover animate-in fade-in duration-700 ${callType === "voice" ? "hidden" : ""}`}
                />
              )}
              
              {/* Show avatar and name if it's a voice call, or if remote stream is not loaded yet */}
              {(callType === "voice" || !remoteStream) && (
                <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
                   {/* Blurred background for no video */}
                   <div className="absolute inset-0 opacity-10 blur-2xl scale-125">
                      <img src={displayInfo?.avatar || "/placeholder.svg"} className="w-full h-full object-cover" alt="" />
                   </div>
                   <div className="relative z-10 text-center">
                    <div className="w-40 h-40 rounded-full border-2 border-gray-700 p-1 mx-auto mb-6 shadow-2xl">
                      <img
                        src={displayInfo?.avatar || "/placeholder.svg?height=160&width=160"}
                        className="w-full h-full rounded-full object-cover"
                        alt=""
                      />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{displayInfo?.name}</h2>
                    <p className="text-[#8696a0] font-medium uppercase tracking-widest text-xs">
                      {callStatus === "connecting" ? "Connecting..." : 
                       callStatus === "calling" ? "Calling..." : 
                       callStatus === "connected" ? "Connected" : "Reconnecting..."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Local Video (Floating Mini Preview) */}
            {callType === "video" && localStream && (
              <div className="absolute top-6 right-6 w-32 md:w-44 h-48 md:h-64 bg-[#202c33] rounded-2xl overflow-hidden border-2 border-[#ffffff20] shadow-2xl z-40 transition-all hover:scale-105 active:scale-95 group cursor-pointer">
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  onLoadedMetadata={(e) => e.target.play()}
                  className="w-full h-full object-cover" 
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-[10px] font-medium uppercase tracking-widest">Self View</span>
                </div>
              </div>
            )}

            {/* Top Navigation Info (Glassmorphism) */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-40 px-6 py-2 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center space-x-3 shadow-xl transition-all">
              <div className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse"></div>
              <p className="text-white text-[10px] font-bold tracking-[0.2em] uppercase">
                {callStatus === 'connected' ? 'Secure Connection' : callStatus}
              </p>
            </div>

            {/* Call Controls (Bottom Floating Bar) */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs md:max-w-md">
              <div className="flex items-center justify-center space-x-6 p-4 mx-4 rounded-3xl bg-[#202c33]/90 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                
                {callType === "video" && (
                  <button
                    onClick={toggleVideo}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                      isVideoEnabled
                        ? "bg-[#3b4a54] hover:bg-[#4a5a64] text-white"
                        : "bg-[#ea0038] hover:bg-[#ff1a4d] text-white"
                    }`}
                  >
                    {isVideoEnabled ? <FaVideo className="w-6 h-6" /> : <FaVideoSlash className="w-6 h-6" />}
                  </button>
                )}

                <button
                  onClick={toggleAudio}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    isAudioEnabled
                      ? "bg-[#3b4a54] hover:bg-[#4a5a64] text-white"
                      : "bg-[#ea0038] hover:bg-[#ff1a4d] text-white"
                  }`}
                >
                  {isAudioEnabled ? <FaMicrophone className="w-6 h-6" /> : <FaMicrophoneSlash className="w-6 h-6" />}
                </button>

                <button
                  onClick={handleEndCall}
                  className="w-16 h-16 bg-[#ea0038] hover:bg-[#ff1a4d] rounded-full flex items-center justify-center text-white shadow-xl transition-all hover:scale-110 active:scale-95"
                >
                  <FaPhoneSlash className="w-8 h-8" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default VideoCallModal
