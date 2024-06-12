#!/bin/bash

if command -v node >/dev/null 2>&1; then
    echo "Installing command 'new-wallpaper' in /usr/local/bin"
    sudo cp new-wallpaper.sh /usr/local/bin/new-wallpaper
    sudo chmod +x /usr/local/bin/new-wallpaper
    echo "Copying dependencies to $HOME/.wallpapers"
    mkdir -p $HOME/.wallpapers
    cp -r . $HOME/.wallpapers/
    cd $HOME/.wallpapers
    mv .env.example .env
    npm install
    echo "Installed 'new-wallpaper'"
else
    echo "Node.js is required but was not found on this system."
    echo "Please install it first from https://nodejs.org/en/download/"
fi
