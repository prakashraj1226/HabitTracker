# Build the Android app again

Use this after you change the design or any other app code. The phone does not update by itself. Each change needs a new APK, then you install that file on the phone.

Run these commands in a terminal, from the project folder.

```bash
cd ~/Videos/Habit/HabitTracker

export JAVA_HOME="$HOME/jdks/jdk-21.0.12.1+1"
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$PATH"

npm run apk
cp android/app/build/outputs/apk/debug/app-debug.apk HabitTracker.apk
```

`npm run apk` builds the website, copies it into the Android project, and creates the APK. The copy step puts the installable file here:

`HabitTracker.apk`

Copy that file to the phone and open it. Install it over the existing Habit Tracker app. Habits already saved on the phone stay on the phone.

The computer site (`npm start`) is separate. Rebuilding the APK does not change `data/tracker.json`.
