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

        console.log("PREDICT DATA:", predictData);

        const listingId =
            predictData.listing_id ||
            predictData.id;

        let internalData = null;

        if (listingId) {

            const internalResponse = await fetch(
                "https://api.brickognize.com/internal/search/results/" + listingId
            );

            internalData = await internalResponse.json();

            console.log("INTERNAL DATA:", internalData);
        }

        res.json({
            predict: predictData,
            internal: internalData
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
