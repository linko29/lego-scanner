import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();

app.use(express.json({ limit: "10mb" }));

app.post("/scan", async (req, res) => {

    try {

        const { imageUrl } = req.body;

        if (!imageUrl) {
            return res.status(400).json({
                error: "imageUrl manquant"
            });
        }

        const imageResponse =
            await fetch(imageUrl);

        const imageBuffer =
            await imageResponse.buffer();

        const formData = new FormData();

        formData.append(
            "query_image",
            imageBuffer,
            "piece.jpg"
        );

        const response = await fetch(
            "https://api.brickognize.com/predict/",
            {
                method: "POST",
                body: formData,
                headers: formData.getHeaders()
            }
        );

        const data = await response.json();

        console.log("BRICKOGNIZE :", data);

        res.json(data);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log("API running on port " + PORT);
});
