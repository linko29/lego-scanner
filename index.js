# lego-scanner
import express from "express";

const app = express();

app.use(express.json({ limit: "10mb" }));

app.post("/scan", async (req, res) => {

  try {

    const { imageUrl } = req.body;

    const imageResponse = await fetch(imageUrl);

    const imageBuffer = await imageResponse.arrayBuffer();

    const formData = new FormData();

    formData.append(
      "query_image",
      new Blob([imageBuffer], { type: "image/jpeg" }),
      "piece.jpg"
    );

    const brickResponse = await fetch(
      "https://api.brickognize.com/predict/",
      {
        method: "POST",
        body: formData
      }
    );

    const data = await brickResponse.json();

    res.json(data);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

app.listen(3000, () => {
  console.log("Server running");
});
