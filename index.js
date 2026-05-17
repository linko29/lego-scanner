import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";
import sharp from "sharp";

const app = express();

app.use(express.json({ limit: "10mb" }));

function rgbToHex(r, g, b) {
    return "#" + [r, g, b]
        .map(x => x.toString(16).padStart(2, "0"))
        .join("");
}

function brightness(r, g, b) {
    return (r + g + b) / 3;
}

app.post("/scan", async (req, res) => {

    try {

        const { imageUrl } = req.body;

        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.buffer();

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

        if (data.items && data.items.length > 0 && data.bounding_box) {

            const item = data.items[0];
            const box = data.bounding_box;

            const originalLeft = Math.max(
                0,
                Math.floor(box.left)
            );

            const originalTop = Math.max(
                0,
                Math.floor(box.upper)
            );

            const originalWidth = Math.max(
                1,
                Math.floor(box.right - box.left)
            );

            const originalHeight = Math.max(
                1,
                Math.floor(box.lower - box.upper)
            );

            // Analyse seulement le centre
            const marginX = Math.floor(originalWidth * 0.35);
            const marginY = Math.floor(originalHeight * 0.35);

            const left = originalLeft + marginX;
            const top = originalTop + marginY;

            const width = Math.max(
                1,
                originalWidth - marginX * 2
            );

            const height = Math.max(
                1,
                originalHeight - marginY * 2
            );

            // Détection fond clair / sombre
            const fullPixels = await sharp(imageBuffer)
                .resize(80, 80)
                .raw()
                .toBuffer();

            let bgR = 0;
            let bgG = 0;
            let bgB = 0;
            let bgCount = 0;

            for (let i = 0; i < fullPixels.length; i += 3) {

                bgR += fullPixels[i];
                bgG += fullPixels[i + 1];
                bgB += fullPixels[i + 2];

                bgCount++;
            }

            bgR = Math.round(bgR / bgCount);
            bgG = Math.round(bgG / bgCount);
            bgB = Math.round(bgB / bgCount);

            const bgBrightness = brightness(
                bgR,
                bgG,
                bgB
            );

            const backgroundType =
                bgBrightness > 150
                    ? "light"
                    : "dark";

            // Pixels du centre de la pièce
            const pixels = await sharp(imageBuffer)
                .extract({
                    left,
                    top,
                    width,
                    height
                })
                .raw()
                .toBuffer();

            const colorMap = {};

            for (let i = 0; i < pixels.length; i += 3) {

                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];

                const br = brightness(r, g, b);

                // Ignore fond clair
                if (
                    backgroundType === "light" &&
                    br > 230
                ) {
                    continue;
                }

                // Ignore fond sombre
                if (
                    backgroundType === "dark" &&
                    br < 70
                ) {
                    continue;
                }

                // Regroupe couleurs proches
                const rr = Math.round(r / 20) * 20;
                const gg = Math.round(g / 20) * 20;
                const bb = Math.round(b / 20) * 20;

                const key = `${rr},${gg},${bb}`;

                colorMap[key] =
                    (colorMap[key] || 0) + 1;
            }

            let dominantColor = null;
            let maxCount = 0;

            for (const key in colorMap) {

                if (colorMap[key] > maxCount) {

                    maxCount = colorMap[key];
                    dominantColor = key;
                }
            }

            if (dominantColor) {

                const [r, g, b] =
                    dominantColor
                        .split(",")
                        .map(Number);

                item.detected_color = {
                    rgb: {
                        r,
                        g,
                        b
                    },

                    hex: rgbToHex(r, g, b),

                    background: backgroundType
                };
            }
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

    console.log(
        "Server running on port 3000"
    );
});
