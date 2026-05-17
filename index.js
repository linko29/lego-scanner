import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";
import Jimp from "jimp";

const app = express();

app.use(express.json({ limit: "10mb" }));

app.post("/scan", async (req, res) => {

    try {

        const { imageUrl } = req.body;

        const imageResponse = await fetch(imageUrl);

        const imageBuffer = await imageResponse.buffer();

        // =========================
        // ANALYSE IMAGE
        // =========================

        const image = await Jimp.read(imageBuffer);

        const width = image.bitmap.width;
        const height = image.bitmap.height;

        // zone centrale plus large
        const marginX = Math.floor(width * 0.25);
        const marginY = Math.floor(height * 0.25);

        // =========================
        // COULEUR FOND
        // =========================

        let bgR = 0;
        let bgG = 0;
        let bgB = 0;
        let bgCount = 0;

        image.scan(0, 0, width, height, function (x, y, idx) {

            const isBorder =
                x < 40 ||
                y < 40 ||
                x > width - 40 ||
                y > height - 40;

            if (isBorder) {

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
        // DETECTION PIECE
        // =========================

        let totalR = 0;
        let totalG = 0;
        let totalB = 0;
        let count = 0;

        image.scan(
            marginX,
            marginY,
            width - marginX * 2,
            height - marginY * 2,
            function (x, y, idx) {

                const r = this.bitmap.data[idx + 0];
                const g = this.bitmap.data[idx + 1];
                const b = this.bitmap.data[idx + 2];

                // distance avec fond
                const distFromBg = Math.sqrt(
                    (r - bgR) ** 2 +
                    (g - bgG) ** 2 +
                    (b - bgB) ** 2
                );

                // ignore fond
                if (distFromBg < 80) {
                    return;
                }

                totalR += r;
                totalG += g;
                totalB += b;

                count++;
            }
        );

        // fallback si pas assez de pixels détectés
        if (count < 50) {

            image.scan(
                marginX,
                marginY,
                width - marginX * 2,
                height - marginY * 2,
                function (x, y, idx) {

                    totalR += this.bitmap.data[idx + 0];
                    totalG += this.bitmap.data[idx + 1];
                    totalB += this.bitmap.data[idx + 2];

                    count++;
                }
            );
        }

        let avgR = Math.round(totalR / count);
        let avgG = Math.round(totalG / count);
        let avgB = Math.round(totalB / count);

        // =========================
        // CORRECTION LUMINOSITE
        // =========================

        const brightness = (avgR + avgG + avgB) / 3;

        // pièce claire
        if (brightness > 170) {

            avgR = Math.max(0, avgR - 35);
            avgG = Math.max(0, avgG - 35);
            avgB = Math.max(0, avgB - 35);

        }

        // pièce sombre
        else if (brightness < 90) {

            avgR = Math.min(255, avgR + 35);
            avgG = Math.min(255, avgG + 35);
            avgB = Math.min(255, avgB + 35);

        }

        // =========================
        // HEX
        // =========================

        const hex =
            "#" +
            avgR.toString(16).padStart(2, "0") +
            avgG.toString(16).padStart(2, "0") +
            avgB.toString(16).padStart(2, "0");

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
        // AJOUT COULEUR
        // =========================

        if (data.items && data.items.length > 0) {

            data.items[0].detected_color = {
                hex,
                rgb: {
                    r: avgR,
                    g: avgG,
                    b: avgB
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
