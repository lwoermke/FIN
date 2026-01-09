import { beforeAll, vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Web Worker
class WorkerMock {
    onmessage: ((ev: MessageEvent) => any) | null = null;
    onerror: ((ev: ErrorEvent) => any) | null = null;
    postMessage(message: any) {
        if (message.type === 'PING') {
            setTimeout(() => {
                if (this.onmessage) {
                    this.onmessage({ data: { type: 'PONG' } } as MessageEvent);
                }
            }, 0);
        }
    }
    terminate() { }
}

vi.stubGlobal('Worker', WorkerMock);

// Mock SharedArrayBuffer
if (typeof SharedArrayBuffer === 'undefined') {
    vi.stubGlobal('SharedArrayBuffer', ArrayBuffer);
}

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock AudioContext
vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => ({
    createOscillator: vi.fn(),
    createGain: vi.fn(),
    connect: vi.fn(),
})));

// Mock indexedDB
vi.stubGlobal('indexedDB', {
    open: vi.fn().mockReturnValue({
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
    }),
});
