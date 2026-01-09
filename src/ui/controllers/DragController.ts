/**
 * [Controller] Drag State Management
 * Simple signal for cross-context drag operations (DOM -> Canvas).
 * Plays audio feedback on drop events.
 */

import { playDropThud } from '../../physics/acoustics/UIAudio.js';

type DragType = 'VOL_CUBE' | 'ENTROPY' | null;

interface DragState {
    active: boolean;
    type: DragType;
}

type DragListener = (state: DragState) => void;

class DragController {
    private state: DragState = { active: false, type: null };
    private listeners: Set<DragListener> = new Set();
    private onDropCallback: ((type: DragType, position: [number, number, number]) => void) | null = null;

    startDrag(type: DragType) {
        this.state = { active: true, type };
        this.notify();
    }

    endDrag() {
        this.state = { active: false, type: null };
        this.notify();
    }

    getState() {
        return this.state;
    }

    private onDropListeners: Set<(type: DragType, pos: [number, number, number]) => void> = new Set();

    subscribe(listener: DragListener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(l => l(this.state));
    }

    // Bridge for drop handling
    onDrop(callback: (type: DragType, pos: [number, number, number]) => void) {
        this.onDropListeners.add(callback);
        return () => this.onDropListeners.delete(callback);
    }

    triggerDrop(position: [number, number, number]) {
        if (this.state.active) {
            // Play drop thud sound
            playDropThud();
            this.onDropListeners.forEach(l => l(this.state.type, position));
        }
        this.endDrag();
    }
}

export const dragController = new DragController();

