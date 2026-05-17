const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("API running");
});

app.post("/scan", async (req, res) => {

    try {

        const imageUrl = req.body.imageUrl;

        if (!imageUrl) {
            return res.status(400).json({
                error: "Missing imageUrl"
            });
        }

        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.buffer();

        const form = new FormData();

        form.append(
            "query_image",
            imageBuffer,
            "lego.jpg"
        );

        const brickognizeResponse = await fetch(
            "https://api.brickognize.com/predict/",
            {
                method: "POST",
                body: form,
                headers: form.getHeaders()
            }
        );

        const predictData = await brickognizeResponse.json();

        const resultId = predictData.id;

        if (!resultId) {
            return res.json({
                error: "No result id",
                raw: predictData
            });
        }

        const internalResponse = await fetch(
            `https://api.brickognize.com/internal/search/results/${resultId}`
        );

        const internalData = await internalResponse.json();

        const piece =
            internalData.detected_items?.[0]
                ?.candidate_items?.[0];

        const color =
            piece?.candidate_colors?.[0];

        res.json({
            name: piece?.name || "Unknown",
            id: piece?.external_items?.[0]?.external_id || piece?.id || "Unknown",
            color: color?.name || "Unknown",
            color_id: color?.external_colors?.[0]?.external_id || null,
            confidence: piece?.score ? Math.round(piece.score * 100) : 0,
            color_confidence: color?.score ? Math.round(color.score * 100) : 0,
            image_url: predictData.items?.[0]?.img_url || null,
            raw_predict: predictData,
            raw_internal: internalData
        });

    } catch (error) {

        console.error("SERVER ERROR :", error);

        res.status(500).json({
            error: error.toString()
        });
    }
});

app.listen(3000, "0.0.0.0", () => {
    console.log("API running on port 3000");
});
