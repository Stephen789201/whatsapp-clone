// Fixed server-side events with proper userId handling

const handleVideoCallEvents = (socket, io, onlineUsers) => {
  // Initiate video call
  socket.on("initiate_call", ({ callerId, receiverId, callType, callerInfo }) => {
    console.log(` SERVER: Call initiated from ${callerId} to ${receiverId}`)
    
    const callId = `${callerId}-${receiverId}-${Date.now()}`
    
    // Emit to receiver's room (all tabs)
    io.to(String(receiverId)).emit("incoming_call", {
      callerId,
      callerName: callerInfo.username,
      callerAvatar: callerInfo.profilePicture,
      callType,
      callId,
    })
  })

  // Accept call
  socket.on("accept_call", ({ callerId, callId, receiverInfo }) => {
    console.log(`SERVER: Call ${callId} accepted by receiver, notifying caller ${callerId}`)

    // Emit to caller's room (all tabs)
    io.to(String(callerId)).emit("call_accepted", {
      callId,
      receiverName: receiverInfo.username,
      receiverAvatar: receiverInfo.profilePicture,
    })
  })

  // Reject call
  socket.on("reject_call", ({ callerId, callId }) => {
    io.to(String(callerId)).emit("call_rejected", { callId })
  })

  // End call
  socket.on("end_call", ({ callId, participantId }) => {
    console.log(` SERVER: Call ${callId} ended, notifying participant ${participantId}`)
    io.to(String(participantId)).emit("call_ended", { callId })
  })

  // WebRTC signaling events with room-based forwarding
  socket.on("webrtc_offer", ({ offer, receiverId, callId }) => {
    const senderId = socket.userId || "unknown";
    console.log(`SERVER: Forwarding offer from ${senderId} to ${receiverId} for call ${callId}`)
    
    io.to(String(receiverId)).emit("webrtc_offer", {
      offer,
      senderId: senderId,
      callId,
    });
  });

  socket.on("webrtc_answer", ({ answer, receiverId, callId }) => {
    const senderId = socket.userId || "unknown";
    console.log(` SERVER: Forwarding answer from ${senderId} to ${receiverId} for call ${callId}`)
    
    io.to(String(receiverId)).emit("webrtc_answer", {
      answer,
      senderId: senderId,
      callId,
    });
  });

  socket.on("webrtc_ice_candidate", ({ candidate, receiverId, callId }) => {
    const senderId = socket.userId || "unknown";
    console.log(` SERVER: Forwarding ICE candidate from ${senderId} to ${receiverId}`)
    
    io.to(String(receiverId)).emit("webrtc_ice_candidate", {
      candidate,
      senderId: senderId,
      callId,
    });
  });
}

module.exports = handleVideoCallEvents
