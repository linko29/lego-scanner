import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";
import Jimp from "jimp";

const app = express();

app.use(express.json({ limit: "10mb" }));

// =========================
// COULEURS LEGO
// =========================

const legoColors = [

    {
        name: "White",
        hex: "#f4f4f4",
        r: 244,
        g: 244,
        b: 244
    },

    {
        name: "Black",
        hex: "#1b1b1b",
        r: 27,
        g: 27,
        b: 27
    },

    {
        name: "Light Bluish Gray",
        hex: "#a0a5a9",
        r: 160,
        g: 165,
        b: 169
    },

    {
        name: "Dark Bluish Gray",
        hex: "#6b6e68",
        r: 107,
        g: 110,
        b: 104
    },

    {
        name: "Tan",
        hex: "#d7c59a",
        r: 215,
        g: 197,
        b: 154
    },

    {
        name: "Dark Tan",
        hex: "#958a73",
        r: 149,
        g: 138,
        b: 115
    },

    {
        name: "Red",
        hex: "#b40000",
        r: 180,
        g: 0,
        b: 0
    },

    {
        name: "Blue",
        hex: "#0057a6",
        r: 0,
        g: 87,
        b: 166
    },

    {
        name: "Yellow",
        hex: "#ffd500",
        r: 255,
        g: 213,
        b: 0
    },

    {
        name: "Green",
        hex: "#237841",
        r: 35,
        g: 120,
        b: 65
    }

];

// =========================
// TROUVER COULEUR LEGO
// =========================

function findClosestLegoColor(r, g, b) {

    let bestColor = null;
    let bestDistance = Infinity;

    for (const color of legoColors) {

        const distance = Math.sqrt(
            (r - color.r) ** 2 +
            (g - color.g) ** 2 +
            (b - color.b) ** 2
        );

        if (distance < bestDistance) {

            bestDistance = distance;
            bestColor = color;

        }

    }

    return bestColor;

}

// =========================
// ROUTE
// =========================

app.post("/scan", async (req, res) => {

    try {

        const { imageUrl } = req.body;

        // =========================
        // DOWNLOAD IMAGE
        // =========================

        const imageResponse = await fetch(imageUrl);

        const imageBuffer = await imageResponse.buffer();

        // =========================
        // IMAGE
        // =========================

        const image = await Jimp.read(imageBuffer);

        // resize pour vitesse
        image.resize(120, Jimp.AUTO);

        const width = image.bitmap.width;
        const height = image.bitmap.height;

        // =========================
        // DETECT FOND
        // =========================

        let bgR = 0;
        let bgG = 0;
        let bgB = 0;

        let bgCount = 0;

        image.scan(0, 0, width, height, function (x, y, idx) {

            const border =
                x < 15 ||
                y < 15 ||
                x > width - 15 ||
                y > height - 15;

            if (border) {

                bgR += this.bitmap.data[idx + 0];
                bgG += this.bitmap.data[idx + 1];
                bgB += this.bitmap.data[idx + 2];

                bgCount++;

            }

        });

        bgR = Math.round(bgR / bgCount);
        bgG = Math.round(bgG / bgCount);
        bgB = Math.round(bgB / bgCount);

        // =========================
        // DETECT PIECE
        // =========================

        let totalR = 0;
        let totalG = 0;
        let totalB = 0;

        let count = 0;

        // ultra rapide
        for (let y = 20; y < height - 20; y += 3) {

            for (let x = 20; x < width - 20; x += 3) {

                const idx = image.getPixelIndex(x, y);

                const r = image.bitmap.data[idx + 0];
                const g = image.bitmap.data[idx + 1];
                const b = image.bitmap.data[idx + 2];

                // différence avec fond
                const diff =
                    Math.abs(r - bgR) +
                    Math.abs(g - bgG) +
                    Math.abs(b - bgB);

                // ignore fond
                if (diff < 90) {
                    continue;
                }

                totalR += r;
                totalG += g;
                totalB += b;

                count++;

            }

        }

        // fallback
        if (count < 10) {

            totalR = bgR;
            totalG = bgG;
            totalB = bgB;

            count = 1;

        }

        // =========================
        // RGB FINAL
        // =========================

        const avgR = Math.round(totalR / count);
        const avgG = Math.round(totalG / count);
        const avgB = Math.round(totalB / count);

        const detectedHex =
            "#" +
            avgR.toString(16).padStart(2, "0") +
            avgG.toString(16).padStart(2, "0") +
            avgB.toString(16).padStart(2, "0");

        // =========================
        // LEGO COLOR
        // =========================

        const legoColor = findClosestLegoColor(
            avgR,
            avgG,
            avgB
        );

        // =========================
        // BRICKOGNIZE
        // =========================

        const formData = new FormData();

        formData.append(
            "query_image",
            imageBuffer,
            "piece.jpg"
        );

        const brickResponse = await fetch(
            "https://api.brickognize.com/predict/",
            {
                method: "POST",
                body: formData,
                headers: formData.getHeaders()
            }
        );

        const data = await brickResponse.json();

        // =========================
        // RESULTAT
        // =========================

        if (data.items && data.items.length > 0) {

            data.items[0].detected_color = {

                detected: {
                    hex: detectedHex,
                    rgb: {
                        r: avgR,
                        g: avgG,
                        b: avgB
                    }
                },

                lego: {
                    name: legoColor.name,
                    hex: legoColor.hex
                }

            };

        }

        res.json(data);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });

    }

});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
