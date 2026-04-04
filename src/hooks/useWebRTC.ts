'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

interface WebRTCOptions {
  channel: RealtimeChannel | null;
  userEmail: string;
}

export function useWebRTC({ channel, userEmail }: WebRTCOptions) {
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
    ],
  };

  const processCandidateQueue = useCallback(async () => {
    if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
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
      setRemoteStream(event.streams[0]);
      setCallStatus('connected');
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        hangUp();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [channel, userEmail]);

  const startLocalStream = async () => {
    try {
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
    setCallStatus('calling');
    setCurrentPeer(targetUser);

    const stream = await startLocalStream();
    if (!stream) return;

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
    setCurrentPeer(senderName);
    setCallStatus('incoming');
    (window as any)._pendingOffer = offer;
  }, []);

  const acceptCall = useCallback(async () => {
    if (!channel || !currentPeer) return;
    const offer = (window as any)._pendingOffer;
    if (!offer) return;

    const stream = await startLocalStream();
    if (!stream) return;

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

    setCallStatus('connected');
  }, [channel, currentPeer, userEmail, createPeerConnection, processCandidateQueue]);

  const handleAnswer = useCallback(async (payload: any) => {
    const { answer } = payload;
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      await processCandidateQueue();
      setCallStatus('connected');
    }
  }, [processCandidateQueue]);

  const handleCandidate = useCallback(async (payload: any) => {
    const { candidate } = payload;
    if (!peerConnectionRef.current || !candidate) return;

    try {
      if (peerConnectionRef.current.remoteDescription && peerConnectionRef.current.remoteDescription.type) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        candidateQueue.current.push(candidate);
      }
    } catch (e) {
      console.error('Error adding received ice candidate', e);
    }
  }, []);

  const hangUp = useCallback(() => {
    // Evitar recursion si ya estamos en proceso de colgar
    if (callStatus === 'idle') return;

    if (peerConnectionRef.current) {
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    // Capturamos el peer antes de limpiarlo para el mensaje de broadcast
    const peerToNotify = currentPeer;

    setRemoteStream(null);
    setCallStatus('idle');
    setCurrentPeer(null);
    
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
  }, [channel, currentPeer, localStream, userEmail, callStatus]);

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
