import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { useGeminiLive } from './useGeminiLive';

// Mock WebSocket
class MockWebSocket {
    static instances: MockWebSocket[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    onclose: (() => void) | null = null;
    send: Mock;
    close: Mock;
    readyState: number = 0;

    constructor(url: string) {
        this.send = vi.fn();
        this.close = vi.fn();
        MockWebSocket.instances.push(this);
        setTimeout(() => {
            this.readyState = 1; // Open
            if (this.onopen) this.onopen();
        }, 10);
    }
}

// Mock AudioContext
class MockAudioContext {
    createMediaStreamSource = vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
    });
    createScriptProcessor = vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
        onaudioprocess: null,
    });
    createBufferSource = vi.fn().mockReturnValue({
        connect: vi.fn(),
        start: vi.fn(),
        buffer: null,
    });
    decodeAudioData = vi.fn().mockResolvedValue({
        duration: 10,
    });
    destination = {};
    state = 'running';
    close = vi.fn();
    currentTime = 0;
}

// Mock navigator.mediaDevices.getUserMedia
const mockGetUserMedia = vi.fn().mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }],
} as any);

describe('useGeminiLive', () => {
    let originalWebSocket: any;
    let originalAudioContext: any;

    beforeEach(() => {
        originalWebSocket = global.WebSocket;
        global.WebSocket = MockWebSocket as any;

        originalAudioContext = window.AudioContext;
        window.AudioContext = MockAudioContext as any;

        Object.defineProperty(navigator, 'mediaDevices', {
            value: {
                getUserMedia: mockGetUserMedia,
            },
            writable: true
        });
    });

    afterEach(() => {
        global.WebSocket = originalWebSocket;
        window.AudioContext = originalAudioContext;
        vi.clearAllMocks();
    });

    it('should initialize with default states', () => {
        const { result } = renderHook(() => useGeminiLive());
        expect(result.current.isConnected).toBe(false);
        expect(result.current.isConnecting).toBe(false);
        expect(result.current.error).toBe(null);
        expect(result.current.currentText).toBe('');
    });

    it('should connect successfully', async () => {
        const { result } = renderHook(() => useGeminiLive());

        await act(async () => {
            result.current.connect({ sourceLang: 'en', targetLang: 'ja', playAudio: false });
        });

        expect(result.current.isConnecting).toBe(true);

        // Wait for MockWebSocket to be created and "opened"
        await waitFor(() => {
            expect(MockWebSocket.instances.length).toBeGreaterThan(0);
            expect(MockWebSocket.instances[0].readyState).toBe(1);
        });

        // Simulate server sending 'connected' message
        await act(async () => {
            const socket = MockWebSocket.instances[0];
            if (socket.onmessage) {
                socket.onmessage({ data: JSON.stringify({ type: 'connected' }) });
            }
        });

        // Now expect isConnecting to be false
        await waitFor(() => expect(result.current.isConnecting).toBe(false));
    });

    // Note: To fully test the WebSocket interactions efficiently, 
    // we would ideallyspy on the MockWebSocket constructor or use a dedicated mock library.
    // For this demonstration, we verify that the connect function triggers state changes.
});
