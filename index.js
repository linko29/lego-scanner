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

        console.log("Downloading image...");

        const imageResponse = await fetch(imageUrl);

        const imageBuffer = await imageResponse.buffer();

        console.log("Uploading to Brickognize...");

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

        const data =
            await brickognizeResponse.json();

        console.log("SUCCESS");

        res.json(data);

    } catch (error) {

        console.error("SERVER ERROR :", error);

        res.status(500).json({
            error: error.toString()
        });
    }
});

const PORT =
    process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `API running on port ${PORT}`
    );
});
