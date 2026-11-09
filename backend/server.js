require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: `You are Solace, a kind and empathetic wellness companion. 
      Respond supportively and naturally. Do not judge the user.
      User says: ${message}`,
    });

    res.json({ reply: response.text });
  } catch (error) {
    console.error("AI Error:", error.message);
    res.status(500).json({ error: "Unable to get a response right now." });
  }
});

app.listen(5000, () => {
  console.log("SolaceAI backend running on port 5000");
});