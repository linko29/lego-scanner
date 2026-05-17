import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";
import sharp from "sharp";

const app = express();

app.use(express.json({ limit: "10mb" }));

function rgbToHex(r, g, b) {
    return (
        "#" +
        [r, g, b]
            .map(x => x.toString(16).padStart(2, "0"))
            .join("")
    );
}

app.post("/scan", async (req, res) => {

    try {

        const { imageUrl } = req.body;

        const imageResponse = await fetch(imageUrl);

        const imageBuffer = await imageResponse.buffer();

        // Brickognize
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

        // Couleur
        if (data.items && data.items.length > 0) {

            const item = data.items[0];

            const box = data.bounding_box;

            const left = Math.max(0, Math.floor(box.left));
            const top = Math.max(0, Math.floor(box.upper));
            const width = Math.floor(box.right - box.left);
            const height = Math.floor(box.lower - box.upper);

            const pixels = await sharp(imageBuffer)
                .extract({
                    left,
                    top,
                    width,
                    height
                })
                .raw()
                .toBuffer();

            let totalR = 0;
            let totalG = 0;
            let totalB = 0;
            let count = 0;

            for (let i = 0; i < pixels.length; i += 3) {

                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];

                const brightness = (r + g + b) / 3;

                // ignore fond clair
                if (brightness < 220) {

                    totalR += r;
                    totalG += g;
                    totalB += b;

                    count++;
                }
            }

            const r = Math.round(totalR / count);
            const g = Math.round(totalG / count);
            const b = Math.round(totalB / count);

            item.detected_color = {
                rgb: { r, g, b },
                hex: rgbToHex(r, g, b)
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
