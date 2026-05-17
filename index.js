import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";
import Jimp from "jimp";

const app = express();

app.use(express.json({ limit: "10mb" }));

function rgbToHex(r, g, b) {
    return "#" + [r, g, b]
        .map(x => x.toString(16).padStart(2, "0"))
        .join("");
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
    return Math.sqrt(
        (r1 - r2) ** 2 +
        (g1 - g2) ** 2 +
        (b1 - b2) ** 2
    );
}

app.post("/scan", async (req, res) => {

    try {

        const { imageUrl } = req.body;

        // ===== DOWNLOAD IMAGE =====

        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.buffer();

        // ===== BRICKOGNIZE =====

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

        // ===== LOAD IMAGE =====

        const image = await Jimp.read(imageBuffer);

        const width = image.bitmap.width;
        const height = image.bitmap.height;

        // ===== DETECT BACKGROUND =====

        const corners = [
            Jimp.intToRGBA(image.getPixelColor(5, 5)),
            Jimp.intToRGBA(image.getPixelColor(width - 5, 5)),
            Jimp.intToRGBA(image.getPixelColor(5, height - 5)),
            Jimp.intToRGBA(image.getPixelColor(width - 5, height - 5))
        ];

        const bgR = Math.round(
            corners.reduce((s, c) => s + c.r, 0) / corners.length
        );

        const bgG = Math.round(
            corners.reduce((s, c) => s + c.g, 0) / corners.length
        );

        const bgB = Math.round(
            corners.reduce((s, c) => s + c.b, 0) / corners.length
        );

        const bgBrightness =
            (bgR * 299 + bgG * 587 + bgB * 114) / 1000;

        const backgroundType =
            bgBrightness > 140 ? "light" : "dark";

        // ===== CENTER ZONE =====

        const marginX = Math.floor(width * 0.35);
        const marginY = Math.floor(height * 0.35);

        const startX = marginX;
        const startY = marginY;

        const endX = width - marginX;
        const endY = height - marginY;

        // ===== COLOR ANALYSIS =====

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

                const brightness =
                    (r * 299 + g * 587 + b * 114) / 1000;

                const distFromBg = colorDistance(
                    r,
                    g,
                    b,
                    bgR,
                    bgG,
                    bgB
                );

                // ===== WHITE PIECE ON DARK BG =====

                if (
                    backgroundType === "dark" &&
                    brightness > 160
                ) {

                    totalR += r;
                    totalG += g;
                    totalB += b;

                    pixelCount++;

                    continue;
                }

                // ===== REMOVE EXTREME PIXELS =====

                if (
                    brightness < 40 ||
                    brightness > 245
                ) {
                    continue;
                }

                // ===== REMOVE BACKGROUND =====

                if (distFromBg < 55) {
                    continue;
                }

                totalR += r;
                totalG += g;
                totalB += b;

                pixelCount++;
            }
        }

        // ===== SAFETY =====

        if (pixelCount === 0) {
            pixelCount = 1;
        }

        // ===== AVERAGE COLOR =====

        const avgR = Math.round(totalR / pixelCount);
        const avgG = Math.round(totalG / pixelCount);
        const avgB = Math.round(totalB / pixelCount);

        // ===== RESULT =====

        if (data.items && data.items.length > 0) {

            data.items[0].detected_color = {

                hex: rgbToHex(avgR, avgG, avgB),

                rgb: {
                    r: avgR,
                    g: avgG,
                    b: avgB
                },

                background: backgroundType,

                background_rgb: {
                    r: bgR,
                    g: bgG,
                    b: bgB
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
