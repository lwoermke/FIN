#!/bin/bash

# [Build] Native macOS arm64 Pipeline
# 1. Clean previous build
# 2. Build Vite frontend
# 3. Compile Electron main/preload
# 4. Package for macOS arm64

echo "🚀 Starting FIN Build Pipeline (macOS arm64)..."

# Exit on error
set -e

# CLEAN
echo "🧹 Cleaning release directory..."
rm -rf release
rm -rf dist

# VITE BUILD
echo "📦 Building Vite frontend (skipping tsc checks for final bundle)..."
npx vite build

# ELECTRON COMPILE
echo "⚙️ Compiling Electron main and preload..."
npm run compile:electron

# ELECTRON BUILDER
echo "🏗️ Packaging application for macOS arm64..."
npm run electron:build -- --mac --arm64

echo "✅ Build Complete! See 'release' folder."
