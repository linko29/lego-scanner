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

        console.log("IMAGE URL :", imageUrl);

        // TELECHARGER IMAGE
        const imageResponse = await fetch(imageUrl);

        const arrayBuffer =
            await imageResponse.arrayBuffer();

        const buffer =
            Buffer.from(arrayBuffer);

        console.log("IMAGE DOWNLOADED");

        // FORM DATA
        const form = new FormData();

        form.append(
            "query_image",
            buffer,
            "lego.jpg"
        );

        console.log("FORM READY");

        // API BRICKOGNIZE
        const apiResponse = await fetch(
            "https://api.brickognize.com/predict/",
            {
                method: "POST",
                body: form,
                headers: form.getHeaders()
            }
        );

        console.log("BRICKOGNIZE STATUS :", apiResponse.status);

        const data =
            await apiResponse.json();

        console.log("DATA :", data);

        res.json(data);

    } catch (error) {

        console.error("SERVER ERROR :", error);

        res.status(500).json({
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
});
