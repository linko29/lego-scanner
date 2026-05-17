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

        // Télécharger image
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.buffer();

        // Envoyer à Brickognize
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

        // Si pièce trouvée
        if (data.items && data.items.length > 0) {

            const item = data.items[0];

            const box = data.bounding_box;

            // Découpage zone pièce
            const left = Math.max(0, Math.floor(box.left));
            const top = Math.max(0, Math.floor(box.upper));
            const width = Math.floor(box.right - box.left);
            const height = Math.floor(box.lower - box.upper);

            const cropped = await sharp(imageBuffer)
                .extract({
                    left,
                    top,
                    width,
                    height
                })
                .resize(1, 1)
                .raw()
                .toBuffer();

            const r = cropped[0];
            const g = cropped[1];
            const b = cropped[2];

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
