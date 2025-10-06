# DonorDex PWA Installation Guide

DonorDex is now a **Progressive Web App (PWA)** that can be installed on macOS, iOS, Android, and Windows!

## 📱 Installation Instructions

### **iOS (iPhone/iPad)**

1. Open **Safari** (must use Safari, not Chrome)
2. Navigate to your DonorDex URL
3. Tap the **Share** button (square with arrow pointing up)
4. Scroll down and tap **"Add to Home Screen"**
5. Tap **"Add"** in the top right
6. DonorDex will now appear on your home screen like a native app!

**Features on iOS:**
- ✅ Launches in fullscreen (no Safari UI)
- ✅ Works offline with cached data
- ✅ Custom Pokédex icon
- ✅ Runs independently from Safari

### **macOS (Safari)**

1. Open **Safari**
2. Navigate to your DonorDex URL
3. Click **File** menu → **Add to Dock**
4. DonorDex will appear in your Dock as a standalone app

**Alternatively:**
1. Look for the **"Install"** banner at the top of the page
2. Click **"Install"** button
3. Or: Safari menu bar → **File** → **Add to Dock**

### **macOS (Chrome/Edge)**

1. Open Chrome or Edge
2. Navigate to your DonorDex URL
3. Look for the **install button** (⊕) in the address bar
4. Or: Click the three dots menu → **Install DonorDex...**
5. Click **Install**
6. DonorDex will open as a standalone app window

### **Android**

1. Open **Chrome**
2. Navigate to your DonorDex URL
3. Tap the banner that says **"Add DonorDex to Home screen"**
4. Or: Tap the three dots menu → **Install app** or **Add to Home screen**
5. Tap **Install** or **Add**

### **Windows**

1. Open **Chrome** or **Edge**
2. Navigate to your DonorDex URL
3. Look for the **install icon** (⊕) in the address bar
4. Or: Click menu → **Install DonorDex...**
5. Click **Install**
6. DonorDex will be added to your Start Menu and Desktop

## 🎯 PWA Features

Once installed, DonorDex provides:

### **Offline Support**
- ✅ Works without internet connection
- ✅ All your data stored locally in IndexedDB
- ✅ Cached static assets (HTML, CSS, JS)
- ✅ Search, filter, and browse offline

### **Native App Experience**
- ✅ Standalone window (no browser UI)
- ✅ Custom icon with Pokédex theme
- ✅ Fast loading from cache
- ✅ Appears in app switcher
- ✅ Can be pinned to dock/taskbar

### **Automatic Updates**
- ✅ Service worker checks for updates
- ✅ Prompts you to reload when new version available
- ✅ Seamless update process

### **Storage**
- ✅ No 5MB localStorage limit
- ✅ IndexedDB can store 100k+ records
- ✅ Data persists even when offline
- ✅ Per-device storage (not synced across devices)

## 🔧 Requirements

### **Minimum Browser Versions:**
- **Safari:** iOS 11.3+ / macOS 11.1+
- **Chrome:** Version 73+
- **Edge:** Version 79+
- **Firefox:** Version 44+ (limited PWA support)

### **Server Requirements:**
- Must be served over **HTTPS** (or localhost for development)
- Service worker requires HTTPS for security

### **Development Testing:**
- `localhost` works without HTTPS
- File protocol (`file://`) does NOT support service workers
- Use a local web server for testing

## 📊 What Gets Cached?

The service worker caches:
- ✅ `index.html`
- ✅ All CSS files
- ✅ All JavaScript modules
- ✅ Dexie.js library
- ✅ Icon and manifest files

**Note:** Your contribution data is stored separately in IndexedDB and is NOT part of the service worker cache.

## 🚀 Benefits vs. Browser Version

### **Installed PWA:**
- Faster startup (cached assets)
- No browser chrome/UI
- Appears as separate app
- Better offline experience
- Can be launched from home screen/dock

### **Browser Version:**
- Easier to share URLs
- No installation required
- Standard browser features (bookmarks, extensions)
- Easier multi-tab usage

Both versions use the **same data** (IndexedDB is per-origin, not per-app).

## ⚠️ Troubleshooting

### **Install button not showing?**
- Ensure you're using HTTPS (not HTTP)
- Check that manifest.json is accessible
- Try hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- On iOS: Must use Safari, not Chrome

### **Offline not working?**
- Check browser console for service worker errors
- Ensure sw.js is in the root directory
- Hard refresh to register new service worker
- Check Developer Tools → Application → Service Workers

### **Updates not applying?**
- Close all DonorDex windows/tabs
- Reopen the app
- Or click "Reload" when prompted

### **Uninstall the PWA:**
- **iOS:** Long press icon → Remove App
- **macOS:** Right-click Dock icon → Remove from Dock
- **Windows:** Start Menu → Right-click → Uninstall
- **Android:** Long press icon → Uninstall

## 🔐 Privacy & Security

- ✅ All data stored locally on your device
- ✅ No server-side storage or sync
- ✅ Service worker only caches public assets
- ✅ IndexedDB data never leaves your device
- ⚠️ Data is NOT backed up automatically
- ⚠️ Clearing browser data will delete your records

## 📱 Icon Generation

If icons are missing:

1. Open `generate-icons.html` in your browser
2. Click "Generate All Icons"
3. Save each icon to `/icons/` folder:
   - icon-16.png, icon-32.png (favicons)
   - icon-72.png, icon-96.png, icon-128.png
   - icon-144.png (Windows tile)
   - icon-152.png, icon-180.png (iOS)
   - icon-192.png, icon-384.png, icon-512.png (PWA)

## 🎨 Customization

You can customize the PWA in `manifest.json`:
- `theme_color` - Browser UI color
- `background_color` - Splash screen background
- `name` / `short_name` - App name
- `description` - App description
- `shortcuts` - Quick actions (Android/Windows)

## ✅ Testing Your PWA

1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Check:
   - **Manifest** - Should show all properties
   - **Service Workers** - Should be "activated and running"
   - **Cache Storage** - Should show cached files
4. Click **Lighthouse** tab
5. Run PWA audit to check installation criteria

---

**Happy tracking! 🎯 Gotta track 'em all!**
