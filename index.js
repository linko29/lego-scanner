const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
    res.send("API running");
});

app.post("/scan", async (req, res) => {

    try {

        console.log("SCAN ROUTE CALLED");

        const { imageUrl } = req.body;

        if (!imageUrl) {
            return res.status(400).json({
                error: "No imageUrl"
            });
        }

        console.log("IMAGE URL:", imageUrl);

        // Télécharger image
        const imageResponse = await fetch(imageUrl);

        const buffer = await imageResponse.buffer();

        console.log("IMAGE DOWNLOADED");

        // FormData
        const form = new FormData();

        form.append(
            "query_image",
            buffer,
            {
                filename: "lego.jpg",
                contentType: "image/jpeg"
            }
        );

        console.log("FORM READY");

        // Appel Brickognize
        const apiResponse = await fetch(
            "https://api.brickognize.com/predict/",
            {
                method: "POST",
                body: form,
                headers: form.getHeaders()
            }
        );

        console.log("BRICKOGNIZE STATUS:", apiResponse.status);

        const data = await apiResponse.json();

        console.log("SUCCESS");

        res.json(data);

    } catch (error) {

        console.error("SERVER ERROR:", error);

        res.status(500).json({
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
});
