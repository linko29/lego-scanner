import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";
import Jimp from "jimp";

const app = express();

app.use(express.json({ limit: "10mb" }));

const LEGO_COLORS = [
    { name: "White", hex: "#FFFFFF" },
    { name: "Black", hex: "#05131D" },
    { name: "Light Bluish Gray", hex: "#A0A5A9" },
    { name: "Dark Bluish Gray", hex: "#6C6E68" },
    { name: "Red", hex: "#C91A09" },
    { name: "Blue", hex: "#0055BF" },
    { name: "Yellow", hex: "#F2CD37" },
    { name: "Green", hex: "#237841" },
    { name: "Tan", hex: "#DEC69C" },
    { name: "Dark Tan", hex: "#958A73" }
];

function hexToRgb(hex) {

    const value = hex.replace("#", "");

    return {
        r: parseInt(value.substring(0, 2), 16),
        g: parseInt(value.substring(2, 4), 16),
        b: parseInt(value.substring(4, 6), 16)
    };

}

function getClosestLegoColor(r, g, b) {

    let best = null;
    let bestDistance = Infinity;

    for (const color of LEGO_COLORS) {

        const rgb = hexToRgb(color.hex);

        const distance =
            Math.pow(r - rgb.r, 2) +
            Math.pow(g - rgb.g, 2) +
            Math.pow(b - rgb.b, 2);

        if (distance < bestDistance) {

            bestDistance = distance;
            best = color;

        }

    }

    return best;

}

app.post("/scan", async (req, res) => {

    try {

        const { imageUrl } = req.body;

        const imageResponse = await fetch(imageUrl);

        const imageBuffer = await imageResponse.buffer();

        const image = await Jimp.read(imageBuffer);

        image.resize(300, Jimp.AUTO);

        const width = image.bitmap.width;
        const height = image.bitmap.height;

        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;

        for (let y = 0; y < height; y++) {

            for (let x = 0; x < width; x++) {

                const color = Jimp.intToRGBA(
                    image.getPixelColor(x, y)
                );

                const brightness =
                    (color.r + color.g + color.b) / 3;

                if (brightness < 235) {

                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;

                }

            }

        }

        const padding = 15;

        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);

        maxX = Math.min(width, maxX + padding);
        maxY = Math.min(height, maxY + padding);

        const crop = image.clone().crop(
            minX,
            minY,
            maxX - minX,
            maxY - minY
        );

        const centerX = Math.floor(crop.bitmap.width / 2);
        const centerY = Math.floor(crop.bitmap.height / 2);

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (let y = centerY - 20; y < centerY + 20; y++) {

            for (let x = centerX - 20; x < centerX + 20; x++) {

                const color = Jimp.intToRGBA(
                    crop.getPixelColor(x, y)
                );

                r += color.r;
                g += color.g;
                b += color.b;

                count++;

            }

        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        const detectedColor = getClosestLegoColor(r, g, b);

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

        if (data.items && data.items.length > 0) {

            data.items[0].detected_color = {
                name: detectedColor.name,
                hex: detectedColor.hex,
                rgb: {
                    r,
                    g,
                    b
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
