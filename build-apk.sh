#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

export JAVA_HOME="$HOME/jdks/jdk-21.0.12.1+1"
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$PATH"

npm run apk
cp android/app/build/outputs/apk/debug/app-debug.apk HabitTracker.apk

echo "APK ready: $(pwd)/HabitTracker.apk"
