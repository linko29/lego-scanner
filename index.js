import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();

app.use(express.json({ limit: "10mb" }));

app.post("/scan", async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: "imageUrl manquant" });
    }

    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.buffer();

    const formData = new FormData();
    formData.append("query_image", imageBuffer, "piece.jpg");

    const predictResponse = await fetch(
      "https://api.brickognize.com/predict/",
      {
        method: "POST",
        body: formData,
        headers: formData.getHeaders()
      }
    );

    const predictData = await predictResponse.json();

    res.json(predictData);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("LEGO scanner API running");
});
