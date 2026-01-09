# **FIN: ARCHITECTURAL DIRECTORY STRUCTURE**

/fin-system-root  
├── /src  
│ ├── /boot  
│ │ ├── hardware_handshake.ts
│ │ └── ...
│ ├── /assets  
│ │ ├── /shaders
│ │ └── /fonts
│ ├── /kernel  
│ │ ├── /registry \# \[1.1\] "The Atomic Truth"  
│ │ │ ├── Store.ts \# The Central Subscriber.  
│ │ │ ├── Vektor.ts \# Type Traceable\<T\> { val, src, time, regime, conf }.  
│ │ │ └── MerkleTree.ts \# \[1.1\] Recursive state hashing.  
│ │ ├── /security \# \[1.2\] Sharded Secure Recovery (SSR)  
│ │ │ ├── ShamirSecret.ts \# SSS splitting logic (2-of-3).  
│ │ │ ├── SecureEnclave.ts \# Bridge to TPM (Shard 2).  
│ │ │ └── IndexedDBEnc.ts \# AES-256-GCM wrapper for Shard 3\.  
│ │ └── /io \# \[1.1\] Delta-Hashing  
│ │ └── StreamHasher.ts \# Offloads integrity checks to SIMD workers.  
│  
│ ├── /math \# AME-V-ALPHA (2.0) \- THE ARSENAL  
│ │ ├── /optimizers \# \[2.1\] H-CDEO  
│ │ │ ├── TensorTournament.ts \# Level 1: Parameter sweeps.  
│ │ │ ├── RegimeWeighter.ts \# Level 2: Model weights.  
│ │ │ └── MatrixVoid.ts \# \[2.1\] The 3D Tensor Output.  
│ │ ├── /kernels \# \[2.2\] Volatility Logic  
│ │ │ ├── rBergomi.ts \# Fractional Brownian Motion (H \< 0.5).  
│ │ │ ├── Matern52.ts \# \[2.4\] GP Kernel for structural scarcity.  
│ │ │ └── JamesStein.ts \# \[2.4\] Shrinkage-enforced inference.  
│ │ ├── /topology \# \[2.3\] TDA  
│ │ │ ├── Persistence.ts \# Betti Number calculator (Homology).  
│ │ │ └── RiemannMetric.ts \# Geodesic distance on SPD manifold.  
│ │ └── /entropy \# \[2.5\] Transfer Entropy  
│ │ ├── Endogenous.ts \# Block A: Macro/Financial data.  
│ │ ├── Exogenous.ts \# Block B: Sentiment/Oracle data.  
│ │ └── Decoupler.ts \# \[2.5\] Enforces 15% weight cap on Block B.  
│  
│ ├── /physics \# SIMULATION LAYER (0.2)  
│ │ ├── /fabric \# \[3.1\] Lattice-Fabric Logic  
│ │ │ ├── MeshDynamics.ts \# Spring-mass logic for lattice threads.  
│ │ │ ├── TensionMap.ts \# Maps Volatility to Z-axis distortion.  
│ │ │ └── ManifoldSlice.ts \# \[3.1\] Logic for the "Slicing Plane".  
│ │ └── /acoustics \# \[3.4\] Stochastic Gating  
│ │ ├── Resonance40Hz.ts \# Event-triggered hum generator.  
│ │ └── GranularSynth.ts \# "Geiger counter" clicks for toxicity \> 1.5σ.  
│  
│ ├── /intelligence \# DATA & MEMORY (7.0)  
│ │ ├── /ingest \# \[Phases 2 & 7.2\]  
│ │ │ ├── EdgarScraper.ts \# SEC Fundamental Scaffolding.  
│ │ │ ├── FredConnector.ts \# Macro-Satellite data.  
│ │ │ ├──  \# yfinance  
│ │ │ ├── \# ExchangeRate API  
│ │ │ ├── \# GNews API  
│ │ │ ├── \# Finnhub API  
│ │ │ └── Polymarket.ts \# \[7.2\] Shadow Odds integration.  
│ │ └── /ledger \# \[7.4\] The Immutable Ledger  
│ │ ├── TradeJournal.ts \# Appends to trades.json.  
│ │ ├── MerkleSeal.ts \# \[5.0\] Generates the "Convergence Vector".  
│ │ └── ForensicSnap.ts \# \[8.1\] Serializes world state at T+0.  
│  
│ ├── /ui \# VISUALIZATION (3.0 & 5.0)  
│ │ ├── /orthographic \# \[3.2\] GRAVITY GLASS (The Facts)  
│ │ │ ├── /workbench \# \[Phase 1\]  
│ │ │ │ ├── Sidebar.tsx \# The magnetic glass input panel.  
│ │ │ │ └── InputForm.tsx \# \[Phase 2\] Asset DNA entry.  
│ │ │ ├── /panels  
│ │ │ │ ├── NewsWire.tsx \# \[7.2\] Exposure-filtered intelligence cards.  
│ │ │ │ └── Portfolio.tsx \# \[7.3\] Aggregated performance & trends.  
│ │ │ └── /hud  
│ │ │ ├── AuraGlow.tsx \# \[6.3\] Integrity indicator.  
│ │ │ └── Convergence.tsx \# \[5.0\] The single 0-100 vector.  
│ │ ├── /isometric \# \[3.1\] LATTICE REALITY (The Feel)  
│ │ │ ├── /viewport  
│ │ │ │ ├── OrbitMap.tsx \# \[7.1\] The Geostationary Globe (3D).  
│ │ │ │ ├── GroundView.tsx\# The primary Lattice interface.  
│ │ │ │ └── WarpTunnel.tsx\# \[3.3\] "Hardware Warp" transition effect.  
│ │ │ ├── /widgets \# \[Phase 3\]  
│ │ │ │ ├── Sparkline.tsx \# \[5.1\] 1D Pulse.  
│ │ │ │ ├── KellyArc.tsx \# \[5.1\] Circular bet size gauge.  
│ │ │ │ └── ZScoreBar.tsx \# \[5.1\] Glowing valuation bar.  
│ │ │ └── /complex \# \[5.2 & 5.3\]  
│ │ │ ├── ConformalCone.tsx \# \[5.2\] 98% Uncertainty Ribbon.  
│ │ │ ├── FactorCube.tsx \# \[5.3\] Rotating 3D Value/Momentum/Size.  
│ │ │ └── VolSurface.tsx \# \[5.3\] Deformed Glass Sheet (IV-smile).  
│ │ └── /controllers  
│ │ └── ScrollVelocity.ts \# \[3.3\] Determines Orbit vs Ground vs Exit.  
│  
│ ├── /automata \# \[8.0\] THE EVOLUTIONARY LOOP  
│ │ ├── Referee.ts \# \[8.2\] Monitors T+1, T+7, T+30 outcomes.  
│ │ ├── RedTeam.ts \# \[Phase 4\] Stress-GAN & Cliff Hunter.  
│ │ └── MutationEngine.ts \# \[8.3\] Adjusts model weights based on failure.  
│  
│ └── /workers \# THREAD ISOLATION  
│ ├── integrity.worker.ts \# 60Hz Merkle tree verification.  
│ └── physics.worker.ts \# Off-main-thread lattice calculation.  
│  
└── package.json \# React, Three.js, R3F, D3-Delaunay, TensorFlow.js