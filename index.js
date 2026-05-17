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

        console.log("IMAGE URL :", imageUrl);

        const imageResponse = await fetch(imageUrl);

        const imageBuffer =
            await imageResponse.buffer();

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

        const predictData =
            await brickognizeResponse.json();

        console.log(
            "PREDICT DATA :",
            JSON.stringify(predictData, null, 2)
        );

        const possibleIds = [

            predictData?.listing_id,

            predictData?.listing?.id,

            predictData?.id

        ].filter(Boolean);

        console.log("POSSIBLE IDS :", possibleIds);

        let internalData = null;

        for (const id of possibleIds) {

            console.log("TEST ID :", id);

            const internalResponse = await fetch(
                `https://api.brickognize.com/internal/search/results/${id}`
            );

            const data =
                await internalResponse.json();

            console.log(
                "INTERNAL DATA :",
                JSON.stringify(data, null, 2)
            );

            const colors =
                data?.detected_items?.[0]
                ?.candidate_items?.[0]
                ?.candidate_colors;

            if (
                colors &&
                colors.length > 0
            ) {

                console.log(
                    "COLORS FOUND WITH ID :",
                    id
                );

                internalData = data;

                break;
            }

            if (!internalData) {
                internalData = data;
            }
        }

        let piece = null;

        if (
            internalData &&
            internalData.detected_items &&
            internalData.detected_items.length > 0
        ) {

            const detected =
                internalData.detected_items[0];

            if (
                detected.candidate_items &&
                detected.candidate_items.length > 0
            ) {

                piece =
                    detected.candidate_items[0];

            } else {

                piece = detected;
            }
        }

        if (
            !piece &&
            predictData.items &&
            predictData.items.length > 0
        ) {

            const p = predictData.items[0];

            piece = {

                name: p.name,

                id: p.id,

                score: p.score,

                candidate_colors: [],

                external_items: [
                    {
                        external_id: p.id
                    }
                ]
            };
        }

        const color =
            piece?.candidate_colors?.[0] || null;

        console.log("FINAL PIECE :", piece);

        console.log("FINAL COLOR :", color);

        res.json({

            name:
                piece?.name || "Unknown",

            id:
                piece?.external_items?.[0]
                ?.external_id ||

                piece?.id ||

                "Unknown",

            color:
                color?.name || "Unknown",

            color_id:
                color?.external_colors?.[0]
                ?.external_id ||

                null,

            confidence:
                piece?.score
                    ? Math.round(
                        piece.score * 100
                    )
                    : 0,

            color_confidence:
                color?.score
                    ? Math.round(
                        color.score * 100
                    )
                    : 0,

            image_url:
                predictData.items?.[0]?.img_url
                || null,

            raw_predict: predictData,

            raw_internal: internalData
        });

    } catch (error) {

        console.error(
            "SERVER ERROR :",
            error
        );

        res.status(500).json({
            error: error.toString()
        });
    }
});

app.listen(3000, "0.0.0.0", () => {

    console.log(
        "API running on port 3000"
    );
});
