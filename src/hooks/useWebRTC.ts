'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

interface WebRTCOptions {
  channel: RealtimeChannel | null;
  userEmail: string;
  onCallSignal: (callback: (event: string, payload: any) => void) => () => void;
}

export function useWebRTC({ channel, userEmail, onCallSignal }: WebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected' | 'ended'>('idle');
  const [currentPeer, setCurrentPeer] = useState<string | null>(null);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const candidateQueue = useRef<RTCIceCandidateInit[]>([]);
  
  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
  };

  const processCandidateQueue = useCallback(async () => {
    if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
      console.log("Procesando candidatos en cola:", candidateQueue.current.length);
      while (candidateQueue.current.length > 0) {
        const candidate = candidateQueue.current.shift();
        if (candidate) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('Error processing queued candidate', e);
          }
        }
      }
    }
  }, []);

  const createPeerConnection = useCallback((targetUser: string) => {
    console.log("Creando PeerConnection para:", targetUser);
    const pc = new RTCPeerConnection(configuration);
    
    pc.onicecandidate = (event) => {
      if (event.candidate && channel) {
        channel.send({
          type: 'broadcast',
          event: 'call_ice_candidate',
          payload: {
            candidate: event.candidate,
            targetUser,
            senderName: userEmail
          }
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("Track remoto detectado!");
      setRemoteStream(event.streams[0]);
      setCallStatus('connected');
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE Connection State:", pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        hangUp();
      } else if (pc.iceConnectionState === 'connected') {
        setCallStatus('connected');
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [channel, userEmail]);

  const startLocalStream = async () => {
    try {
      console.log("Solicitando acceso al micrófono...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('Error accessing microphone:', err);
      return null;
    }
  };

  const makeCall = async (targetUser: string) => {
    if (!channel) return;
    console.log("Iniciando llamada a:", targetUser);
    setCallStatus('calling');
    setCurrentPeer(targetUser);

    const stream = await startLocalStream();
    if (!stream) {
      setCallStatus('idle');
      return;
    }

    const pc = createPeerConnection(targetUser);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await channel.send({
      type: 'broadcast',
      event: 'call_offer',
      payload: {
        offer,
        targetUser,
        senderName: userEmail
      }
    });
  };

  const handleOffer = useCallback(async (payload: any) => {
    const { offer, senderName } = payload;
    console.log("Oferta de llamada recibida de:", senderName);
    setCurrentPeer(senderName);
    setCallStatus('incoming');
    (window as any)._pendingOffer = offer;
  }, []);

  const acceptCall = useCallback(async () => {
    if (!channel || !currentPeer) return;
    const offer = (window as any)._pendingOffer;
    if (!offer) return;

    console.log("Aceptando llamada de:", currentPeer);
    const stream = await startLocalStream();
    if (!stream) {
      hangUp();
      return;
    }

    const pc = createPeerConnection(currentPeer);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await processCandidateQueue();
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await channel.send({
      type: 'broadcast',
      event: 'call_answer',
      payload: {
        answer,
        targetUser: currentPeer,
        senderName: userEmail
      }
    });

    // setCallStatus('connected'); // Se establece en ontrack o iceconnected
  }, [channel, currentPeer, userEmail, createPeerConnection, processCandidateQueue]);

  const handleAnswer = useCallback(async (payload: any) => {
    const { answer } = payload;
    console.log("Respuesta de llamada recibida.");
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      await processCandidateQueue();
    }
  }, [processCandidateQueue]);

  const handleCandidate = useCallback(async (payload: any) => {
    const { candidate } = payload;
    if (!candidate || !candidate.candidate) return;

    if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription && peerConnectionRef.current.remoteDescription.type) {
      try {
        console.log("Añadiendo candidato ICE inmediatamente");
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding received ice candidate', e);
      }
    } else {
      console.log("Encolando candidato ICE para después");
      candidateQueue.current.push(candidate);
    }
  }, []);

  const hangUp = useCallback(() => {
    console.log("Finalizando comunicación...");
    const peerToNotify = currentPeer;

    if (peerConnectionRef.current) {
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    setRemoteStream(null);
    setCallStatus('idle');
    setCurrentPeer(null);
    candidateQueue.current = [];
    
    if (channel && peerToNotify) {
       channel.send({
         type: 'broadcast',
         event: 'call_hangup',
         payload: {
           targetUser: peerToNotify,
           senderName: userEmail
         }
       }).catch(e => console.error("Error al enviar hangup:", e));
    }
  }, [channel, currentPeer, localStream, userEmail]);

  // Switchboard Listener
  useEffect(() => {
    const unsubscribe = onCallSignal((event, payload) => {
      switch (event) {
        case 'call_offer': handleOffer(payload); break;
        case 'call_answer': handleAnswer(payload); break;
        case 'call_ice_candidate': handleCandidate(payload); break;
        case 'call_hangup': hangUp(); break;
      }
    });
    return () => unsubscribe();
  }, [onCallSignal, handleOffer, handleAnswer, handleCandidate, hangUp]);

  return {
    localStream,
    remoteStream,
    callStatus,
    currentPeer,
    makeCall,
    acceptCall,
    hangUp,
    handleOffer,
    handleAnswer,
    handleCandidate,
    setCallStatus
  };
}
