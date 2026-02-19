#!/bin/bash

# Navigate to the folder where this script lives
cd "$(dirname "$0")"

PORT=8000

# Kill anything already on the port
lsof -ti :$PORT | xargs kill -9 2>/dev/null
sleep 1

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    osascript -e 'display alert "Python 3 is not installed." message "Please install it from https://www.python.org/downloads/"'
    exit 1
fi

# Open browser after short delay
(sleep 2 && open "http://localhost:$PORT") &

# Start server
python3 -m http.server $PORT
