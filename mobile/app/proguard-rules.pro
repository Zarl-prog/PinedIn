# Release builds keep minification off for now (see app/build.gradle.kts), so this
# file is a placeholder for when R8 is enabled.

# Room generates implementations reflectively referenced by the runtime.
-keep class * extends androidx.room.RoomDatabase { <init>(); }

# ML Kit barcode scanning loads its model classes dynamically.
-keep class com.google.mlkit.** { *; }
