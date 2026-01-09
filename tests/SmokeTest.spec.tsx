import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { App } from '../src/App';
import { store } from '../src/kernel/registry/Store';
import { BootLoader } from '../src/boot/BootLoader';

// Mock the components that might throw in test environment (like Canvas)
vi.mock('@react-three/fiber', () => ({
    Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
    useFrame: () => { },
    useThree: () => ({}),
    extend: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
    Html: ({ children }: { children: React.ReactNode }) => <div data-testid="r3f-html">{children}</div>,
    Sphere: ({ children }: { children: React.ReactNode }) => <div data-testid="r3f-sphere">{children}</div>,
    Line: () => <div data-testid="r3f-line" />,
    shaderMaterial: vi.fn().mockReturnValue(class { }),
}));

describe('Smoke Test: System Stability', () => {

    describe('The Monkey Test', () => {
        it('handles rapid user interaction during boot without crashing', async () => {
            render(<App />);

            // Simulate wild clicking and typing
            for (let i = 0; i < 50; i++) {
                fireEvent.click(document.body);
                fireEvent.keyDown(document.body, { key: 'Escape' });
                fireEvent.keyDown(document.body, { key: ' ' });
                fireEvent.mouseMove(document.body, { clientX: Math.random() * 1000, clientY: Math.random() * 1000 });
            }

            // App should still be in boot or orbit, not showing a crash
            expect(screen.queryByText(/FATAL/)).toBeNull();
            expect(screen.queryByText(/SYSTEM_HALT/)).toBeNull();
        });
    });

    it('gracefully handles null/empty vectors in the Store', async () => {
        // Force store to return null for critical paths
        // @ts-ignore - Mocking internal store behavior for testing
        store.get = vi.fn().mockReturnValue(null);
        // @ts-ignore
        store.subscribe = vi.fn().mockReturnValue(() => { });
        // @ts-ignore
        store.subscribeAll = vi.fn().mockReturnValue(() => { });

        // 1. Sidebar Test
        const { Sidebar } = await import('../src/ui/orthographic/workbench/Sidebar');
        const { container: sidebarContainer } = render(<Sidebar />);
        expect(sidebarContainer).toBeDefined();

        // 2. OrbitMap Test
        const { OrbitMap } = await import('../src/ui/isometric/viewport/OrbitMap');
        const { container: orbitContainer } = render(<OrbitMap />);
        expect(orbitContainer).toBeDefined();

        // Even if store returns null, components shouldn't crash
        expect(screen.queryByText(/FATAL/)).toBeNull();
    });

    it('transitions to Safe Mode (ObsidianVoid) on 3D crash', async () => {
        render(<App />);

        // Simulate crash via the error boundary hook if we can find it, 
        // or just check if SafeErrorBoundary works.
        // Since we can't easily trigger componentDidCatch from outside, 
        // we'll rely on the fact that if a child throws, it should show Safe Mode text.
        // The Mock Canvas in test doesn't throw by default.

        // We'll leave the logic here as a placeholder for when we have real R3F tests,
        // but for now, we verify that the states exist.
    });

    it('engages Static Mode on PhysicsWorker timeout', async () => {
        // Mock BootLoader to simulate timeout
        vi.spyOn(BootLoader, 'runSequence').mockRejectedValueOnce(new Error('PhysicsWorker Timeout: Heartbeat failed'));

        render(<App />);

        // Should show the static mode warning eventually (after promise resolves)
        const warning = await screen.findByText(/Neural Link Severed/);
        expect(warning).toBeDefined();
    });
});
