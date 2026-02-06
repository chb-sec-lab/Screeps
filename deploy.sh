#!/bin/bash
TARGET="/home/love/.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/compatdata/464350/pfx/drive_c/users/steamuser/AppData/Local/Screeps/scripts/screeps.com/0.001beta/"

echo "Kopiere Skripte nach Steam..."
cp *.js "$TARGET"
echo "Fertig!"