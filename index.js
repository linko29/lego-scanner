import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";
import Jimp from "jimp";

const app = express();

app.use(express.json({ limit: "10mb" }));

// -----------------------------
// RGB -> HEX
// -----------------------------

function rgbToHex(r, g, b) {

    return (
        "#" +
        [r, g, b]
            .map(x => x.toString(16).padStart(2, "0"))
            .join("")
    );
}

// -----------------------------
// Distance couleur
// -----------------------------

function colorDistance(r1, g1, b1, r2, g2, b2) {

    return Math.sqrt(
        (r1 - r2) ** 2 +
        (g1 - g2) ** 2 +
        (b1 - b2) ** 2
    );
}

// -----------------------------
// ROUTE SCAN
// -----------------------------

app.post("/scan", async (req, res) => {

    try {

        const { imageUrl } = req.body;

        // -----------------------------
        // Télécharger image
        // -----------------------------

        const imageResponse = await fetch(imageUrl);

        const imageBuffer = await imageResponse.buffer();

        // -----------------------------
        // Envoyer à Brickognize
        // -----------------------------

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

        // -----------------------------
        // Analyse image
        // -----------------------------

        const image = await Jimp.read(imageBuffer);

        const width = image.bitmap.width;
        const height = image.bitmap.height;

        // -----------------------------
        // Détection fond via coins
        // -----------------------------

        const corners = [

            Jimp.intToRGBA(
                image.getPixelColor(5, 5)
            ),

            Jimp.intToRGBA(
                image.getPixelColor(width - 5, 5)
            ),

            Jimp.intToRGBA(
                image.getPixelColor(5, height - 5)
            ),

            Jimp.intToRGBA(
                image.getPixelColor(width - 5, height - 5)
            )
        ];

        const bgR = Math.round(
            corners.reduce((s, c) => s + c.r, 0)
            / corners.length
        );

        const bgG = Math.round(
            corners.reduce((s, c) => s + c.g, 0)
            / corners.length
        );

        const bgB = Math.round(
            corners.reduce((s, c) => s + c.b, 0)
            / corners.length
        );

        const bgBrightness =
            (bgR * 299 + bgG * 587 + bgB * 114)
            / 1000;

        // -----------------------------
        // Type fond
        // -----------------------------

        const backgroundType =
            bgBrightness > 140
                ? "light"
                : "dark";

        // -----------------------------
        // Bounding Box
        // -----------------------------

        let startX = 0;
        let startY = 0;
        let endX = width;
        let endY = height;

        if (data.bounding_box) {

            startX = Math.max(
                0,
                Math.floor(data.bounding_box.left)
            );

            startY = Math.max(
                0,
                Math.floor(data.bounding_box.upper)
            );

            endX = Math.min(
                width,
                Math.floor(data.bounding_box.right)
            );

            endY = Math.min(
                height,
                Math.floor(data.bounding_box.lower)
            );
        }

        // -----------------------------
        // Analyse couleur
        // -----------------------------

        let totalR = 0;
        let totalG = 0;
        let totalB = 0;

        let pixelCount = 0;

        for (let y = startY; y < endY; y++) {

            for (let x = startX; x < endX; x++) {

                const pixel = Jimp.intToRGBA(
                    image.getPixelColor(x, y)
                );

                const r = pixel.r;
                const g = pixel.g;
                const b = pixel.b;

                // luminosité pixel

                const brightness =
                    (r * 299 + g * 587 + b * 114)
                    / 1000;

                // distance fond

                const distFromBg = colorDistance(
                    r, g, b,
                    bgR, bgG, bgB
                );

                // différence luminosité

                const brightnessDiff = Math.abs(
                    brightness - bgBrightness
                );

                // -----------------------------
                // LOGIQUE INTELLIGENTE
                // -----------------------------

                if (
                    backgroundType === "dark" &&
                    brightness > 170
                ) {

                    // garde pixels lumineux

                }
                else if (
                    distFromBg < 45 &&
                    brightnessDiff < 25
                ) {

                    continue;
                }

                // -----------------------------

                totalR += r;
                totalG += g;
                totalB += b;

                pixelCount++;
            }
        }

        // sécurité

        if (pixelCount === 0) {

            pixelCount = 1;
        }

        const avgR = Math.round(
            totalR / pixelCount
        );

        const avgG = Math.round(
            totalG / pixelCount
        );

        const avgB = Math.round(
            totalB / pixelCount
        );

        // -----------------------------
        // Couleur détectée
        // -----------------------------

        const detectedColor = {

            hex: rgbToHex(
                avgR,
                avgG,
                avgB
            ),

            rgb: {

                r: avgR,
                g: avgG,
                b: avgB
            }
        };

        // -----------------------------
        // Ajouter résultat
        // -----------------------------

        if (
            data.items &&
            data.items.length > 0
        ) {

            data.items[0].detected_color =
                detectedColor;
        }

        console.log(data);

        res.json(data);

    } catch (error) {

        console.error(error);

        res.status(500).json({

            error: error.message
        });
    }
});

// -----------------------------
// START SERVER
// -----------------------------

app.listen(3000, () => {

    console.log(
        "Server running on port 3000"
    );
});
