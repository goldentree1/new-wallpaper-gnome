import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import qs from "node:querystring";
// import { exit } from "node:process";
import { fileURLToPath } from 'url';
import { execSync } from "node:child_process";

// Allow __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define constants
const MIN_DOWNLOADED_UNSPLASH_WALLPAPERS = 10;
const UNSPLASH_WALLPAPERS_DIR = "unsplash_wallpapers";
const PERSONAL_WALLPAPERS_DIR = "my_wallpapers";

// Load .env variables
/** @type {string} */
const accessKey = process.env.ACCESS_KEY;
/** @type {string[]} */
const collections = JSON.parse(`[${process.env.COLLECTIONS.split(",").map(c => `"${c}"`)}]`);
/** @type {number} */
const personalWallpapersRatio = parseFloat(process.env.MY_WALLPAPERS_RATIO);

// Load files from each directory
let downloadedUnsplashWallpapers = fs.readdirSync(path.join(__dirname, UNSPLASH_WALLPAPERS_DIR));
const personalWallpapers = fs.readdirSync(path.join(__dirname, PERSONAL_WALLPAPERS_DIR));

// Use a personal wallpaper, or one downloaded from unsplash?
const usePersonalWallpaper = Math.random() < personalWallpapersRatio;
if (usePersonalWallpaper) { // Personal wallpaper
    console.log("Using personal wallpaper")
    if (personalWallpapers.length < 1) {
        console.error("No files were found in 'my_wallpapers'. Please add photos to the directory, or set MY_WALLPAPERS_RATIO to 0 so your own wallpapers are not set as the background.")
    }
    setRndWallpaper(personalWallpapers);
} else { // Unsplash wallpaper
    console.log("Using Unsplash wallpaper")
    if (downloadedUnsplashWallpapers.length < 1) {
        console.error("Unsplash wallpaper was selected, but none are downloaded! Downloading one for you...");
        await downloadUnsplashWallpapers(
            accessKey,
            collections,
            1,
            path.join(__dirname, UNSPLASH_WALLPAPERS_DIR)
        );
        downloadedUnsplashWallpapers = fs.readdirSync(path.join(__dirname, UNSPLASH_WALLPAPERS_DIR));
    }
    const currWallpaper = execSync("gsettings get org.gnome.desktop.background picture-uri");
    const currDarkWallpaper = execSync("gsettings get org.gnome.desktop.background picture-uri-dark");

    const rmOldUnsplashWallpaper = (uri) => {
        const filePath = uri.trim().replace(/^'|'$/g, '').replace('file://', '');
        if (fs.existsSync(filePath)) {
            fs.rmSync(path.resolve(filePath), { force: true });
            console.log(`Deleted old Unsplash wallpaper ${filePath}`);
        } else {
            console.log(`Tried to remove non-existent Unsplash wallpaper: ${filePath}`);
        }
    };
    rmOldUnsplashWallpaper(currWallpaper.toString());
    if (currWallpaper.toString() !== currDarkWallpaper.toString) {
        rmOldUnsplashWallpaper(currDarkWallpaper.toString());
    }

    setRndWallpaper(downloadedUnsplashWallpapers);
}

// Download Unsplash wallpapers until there are 'MIN_DOWNLOADED_UNSPLASH_WALLPAPERS'
if (downloadedUnsplashWallpapers.length < MIN_DOWNLOADED_UNSPLASH_WALLPAPERS) {
    downloadUnsplashWallpapers(
        accessKey,
        collections,
        MIN_DOWNLOADED_UNSPLASH_WALLPAPERS - downloadedUnsplashWallpapers.length,
        path.join(__dirname, UNSPLASH_WALLPAPERS_DIR)
    );
}

/**
 * @param {string[]} files 
 */
function setRndWallpaper(files) {
    const rndWallpaper = files[Math.floor(Math.random() * files.length)];
    setWallpaper(rndWallpaper);
}

/**
 * @param {string} filePath 
 */
function setWallpaper(filePath) {
    try {
        const fullPath = path.resolve(__dirname, UNSPLASH_WALLPAPERS_DIR, filePath);
        execSync(`gsettings set org.gnome.desktop.background picture-uri file://${fullPath}`);
        execSync(`gsettings set org.gnome.desktop.background picture-uri-dark file://${fullPath}`);
        console.log(`Set new wallpaper ${filePath}`)
    } catch (error) {
        console.error("Error setting wallpaper:", error);
    }
}

/**
 * @param {string} accessKey 
 * @param {string[]} collections 
 * @param {number} count 
 * @param {string} downloadDir
 */
async function downloadUnsplashWallpapers(accessKey, collections, count, downloadDir) {

    // get new unsplash photo URLs

    console.log("Sending request for new photos to Unsplash")
    const query = qs.stringify({
        orientation: "landscape",
        count,
        collections: collections.toString(),
    });

    const res = await fetch(`https://api.unsplash.com/photos/random?${query}`, {
        headers: {
            "Authorization": `Client-ID ${accessKey}`
        },
    });
    const json = await res.json();
    const photoUrls = json.map((data) => data.urls.full);

    console.log(`Received photo URLS from unsplash: ${photoUrls}`)

    // download the photos
    console.log("Downloading photos from Unsplash...")
    await Promise.all(
        photoUrls.map((url) => {
            return new Promise((resolve, reject) => {
                const imageName = url.split('/').pop().split("?")[0] + ".jpg";
                const file = fs.createWriteStream(path.join(downloadDir, imageName));

                https.get(url, (response) => {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close(() => {
                            console.log(`Downloaded "${imageName}"`);
                            resolve();
                        });
                    });
                    file.on('error', (err) => {
                        fs.unlink(path.join(downloadDir, imageName), () => {
                            reject(err);
                        });
                    });
                }).on('error', (err) => {
                    fs.unlink(path.join(downloadDir, imageName), () => {
                        reject(err);
                    });
                });
            });
        })
    );

}
