#!/bin/bash
# AutoScheduler — Linux Setup Script

echo ""
echo "====================================================="
echo " AutoScheduler — First-Time Linux Setup"
echo "====================================================="
echo ""

# 1. Check Node.js
echo "[1/4] Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo ""
    echo "[ERROR] Node.js is NOT installed."
    echo "Please install Node.js (v18+) using your package manager."
    echo "Example: sudo apt install nodejs npm"
    echo ""
    exit 1
fi
NODE_VER=$(node --version)
echo "      Found Node.js $NODE_VER"

# 2. Check Python
echo "[2/4] Checking Python..."
if command -v python3 &> /dev/null; then
    PY_CMD="python3"
elif command -v python &> /dev/null; then
    PY_CMD="python"
else
    echo ""
    echo "[ERROR] Python is NOT installed."
    echo "Please install Python (3.10+)."
    echo "Example: sudo apt install python3 python3-pip"
    echo ""
    exit 1
fi
PY_VER=$($PY_CMD --version)
echo "      Found $PY_VER ($PY_CMD)"

# 3. Create .env if missing
echo "[3/4] Checking environment file..."
if [ ! -f ".env" ]; then
    echo "      .env not found — copying from .env.example..."
    cp .env.example .env
    echo "      .env created. You can edit it any time."
else
    echo "      .env already exists. Skipping."
fi

# 4. Install dependencies
echo "[4/4] Installing dependencies (this may take a few minutes)..."
echo ""
echo "--- Installing root Node packages (concurrently) ---"
npm install
if [ $? -ne 0 ]; then
    echo "[ERROR] Root npm install failed."
    exit 1
fi

echo ""
echo "--- Installing frontend packages ---"
cd frontend && npm install
if [ $? -ne 0 ]; then
    echo "[ERROR] Frontend npm install failed."
    cd ..
    exit 1
fi
cd ..

echo ""
echo "--- Installing Python backend packages ---"
cd backend
if command -v pip3 &> /dev/null; then
    PIP_CMD="pip3"
else
    PIP_CMD="pip"
fi
$PIP_CMD install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "[ERROR] Python dependencies installation failed."
    cd ..
    exit 1
fi
cd ..

echo ""
echo "====================================================="
echo " Setup complete!"
echo "====================================================="
echo ""
echo " Next step: Run the app using: ./start_linux.sh"
echo ""
