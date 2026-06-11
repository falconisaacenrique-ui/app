/**
 * The Mesh — serverless device-to-device sync. WebRTC with *manual*
 * signaling: device A generates a pairing code (its compressed offer),
 * device B pastes it and answers with its own code. No signaling server,
 * no STUN, no accounts — the devices talk directly (same network).
 */

async function compress(text: string): Promise<string> {
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return 'z' + btoa(bin);
  } catch {
    return 'p' + btoa(unescape(encodeURIComponent(text)));
  }
}

async function decompress(code: string): Promise<string> {
  const mode = code[0];
  const bin = atob(code.slice(1));
  if (mode === 'p') return decodeURIComponent(escape(bin));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

function waitIceComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
    setTimeout(resolve, 3000); // settle with whatever we have
  });
}

export interface SyncSession {
  /** Resolves with the full remote payload once both sides have exchanged. */
  exchange: (localPayload: string) => Promise<string>;
  close: () => void;
}

export interface HostStart {
  code: string;
  acceptAnswer: (answerCode: string) => Promise<SyncSession>;
}

function makeSession(pc: RTCPeerConnection, channel: RTCDataChannel): SyncSession {
  return {
    exchange: (localPayload: string) =>
      new Promise<string>((resolve, reject) => {
        const chunks: string[] = [];
        channel.onmessage = (e) => {
          if (e.data === '') {
            resolve(chunks.join(''));
          } else {
            chunks.push(e.data as string);
          }
        };
        channel.onerror = () => reject(new Error('sync channel failed'));
        // send in chunks (data channels dislike huge single messages)
        for (let i = 0; i < localPayload.length; i += 12000) {
          channel.send(localPayload.slice(i, i + 12000));
        }
        channel.send('');
        setTimeout(() => reject(new Error('sync timed out')), 30000);
      }),
    close: () => {
      channel.close();
      pc.close();
    },
  };
}

/** Device A: create the offer and return its pairing code. */
export async function startHost(): Promise<HostStart> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  const channel = pc.createDataChannel('lifehub');
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitIceComplete(pc);
  const code = await compress(JSON.stringify(pc.localDescription));
  return {
    code,
    acceptAnswer: async (answerCode: string) => {
      const answer = JSON.parse(await decompress(answerCode.trim())) as RTCSessionDescriptionInit;
      await pc.setRemoteDescription(answer);
      await new Promise<void>((resolve, reject) => {
        if (channel.readyState === 'open') return resolve();
        channel.onopen = () => resolve();
        setTimeout(() => reject(new Error('could not connect — are both devices on the same network?')), 15000);
      });
      return makeSession(pc, channel);
    },
  };
}

/** Device B: consume the host's code, return our answer code + session. */
export async function joinHost(
  hostCode: string,
): Promise<{ code: string; session: Promise<SyncSession> }> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  const sessionPromise = new Promise<SyncSession>((resolve, reject) => {
    pc.ondatachannel = (e) => {
      const channel = e.channel;
      if (channel.readyState === 'open') resolve(makeSession(pc, channel));
      else channel.onopen = () => resolve(makeSession(pc, channel));
    };
    setTimeout(() => reject(new Error('could not connect — are both devices on the same network?')), 20000);
  });
  const offer = JSON.parse(await decompress(hostCode.trim())) as RTCSessionDescriptionInit;
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitIceComplete(pc);
  const code = await compress(JSON.stringify(pc.localDescription));
  return { code, session: sessionPromise };
}
