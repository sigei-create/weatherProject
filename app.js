const express = require("express");
const https = require("https");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public")); // serve CSS/JS/images
app.set("view engine", "ejs");

// MongoDB setup
const uri = process.env.MONGO_URI || "mongodb://localhost:27017"; // use env var if available
const client = new MongoClient(uri);
let collection;

async function start() {
  try {
    await client.connect();
    const db = client.db("weatherApp");
    collection = db.collection("searchHistory");
    console.log("✅ Connected to MongoDB");

    const port = process.env.PORT || 3000; // only declare once here
    app.listen(port, () => {
      console.log(`✅ Server running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
}
start();

// Routes
app.get("/", (req, res) => {
  res.render("index");
});

app.post("/", (req, res) => {
  const city = req.body.city;
  const apiKey = process.env.OPENWEATHER_API_KEY || "f4d4f440c21af1bc30bae1efc32d5d5f"; // safer with env var
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
    city
  )}&appid=${apiKey}&units=metric`;

  https
    .get(url, (response) => {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", async () => {
        try {
          const weatherData = JSON.parse(data);

          if (weatherData.cod != 200) {
            res.render("result", { error: weatherData.message });
            return;
          }

          const temp = weatherData.main.temp;
          const description = weatherData.weather[0].description;
          const icon = weatherData.weather[0].icon;
          const iconUrl = `http://openweathermap.org/img/wn/${icon}@2x.png`;

          // Save to MongoDB
          await collection.insertOne({
            city: weatherData.name,
            temp,
            description,
            icon,
            date: new Date(),
          });

          res.render("result", {
            city: weatherData.name,
            temp,
            description,
            iconUrl,
            error: null,
          });
        } catch (err) {
          console.error(err);
          res.render("result", { error: "Error parsing weather data." });
        }
      });
    })
    .on("error", (err) => {
      console.error("Error with request:", err);
      res.render("result", { error: "Error fetching weather data." });
    });
});

app.get("/history", async (req, res) => {
  const history = await collection.find().sort({ date: -1 }).toArray();
  res.render("history", { history });
});







