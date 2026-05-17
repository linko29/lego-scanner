import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
    res.send("API running");
});

app.post("/scan", async (req, res) => {

    try {

        const { imageUrl } = req.body;

        if (!imageUrl) {
            return res.status(400).json({
                error: "No imageUrl"
            });
        }

        // télécharger image
        const imageResponse = await fetch(imageUrl);
        const buffer = await imageResponse.buffer();

        // envoyer à Bricognize
        const form = new FormData();

        form.append("query_image", buffer, {
            filename: "lego.jpg",
            contentType: "image/jpeg"
        });

        const apiResponse = await fetch(
            "https://api.brickognize.com/predict/",
            {
                method: "POST",
                body: form,
                headers: form.getHeaders()
            }
        );

        const data = await apiResponse.json();

        console.log(data);

        res.json(data);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log("API running on port", PORT);
});
