import express from "express";
import mysql from "mysql";
import axios from "axios";
import nodemailer from "nodemailer";
import cors from "cors";

const app = express();


app.use(express.json());
app.use(cors());

export const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "weather",
});

db.connect((err) => {
  if (err) throw err;
  console.log("Connected Database...");
});

app.get('/', (req, res) => {
    const html = `
    <html>
        <body>
            <h1>Hello from Weather Dashboard</h1>
        </body>
    </html>
    `;
    res.send(html);
});

app.get('/getWeatherInfo', async (req, res) => {
    const q = req.query.q || '';
    console.log(q)
    try {
        const response = await axios.get(`http://api.weatherapi.com/v1/forecast.json`, {
            params: {
                key: 'c51aaf3dcc494cc8865115316242607',
                q: q,
                days: 5
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/getLocationByIP', async (req, res) => {
    try {
        const cityResponse = await axios.get('https://api.db-ip.com/v2/free/self');
        const cityname = cityResponse.data.city;
        const location = await getLocationByCityName(cityname);
        res.json({ location });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const getLocationByCityName = async (name) => {
    try {
        const url = `https://api.api-ninjas.com/v1/geocoding?city=${name}`;
        const headers = { 'X-Api-Key': 'sycEOmug3GpUajiEHTFeUw==pSeXtHtQGiOYhBHS' };

        const response = await axios.get(url, { headers });
        const data = response.data;

        if (data.length > 0) {
            const coordinates = {
                lat: data[0].latitude,
                lng: data[0].longitude
            };
            return `${coordinates.lat},${coordinates.lng}`;
        } else {
            console.log("No data found for the city.");
            return null;
        }
    } catch (error) {
        console.error('Error fetching location: ', error.message);
        throw error;
    }
}



app.post('/register', async (req, res) => {    
    const { gmail, location } = req.body;

    try {
        const q = "SELECT COUNT(*) as count FROM `mail` WHERE gmail = ?";
        
        db.query(q, [gmail], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const count = results[0].count;

            if (count > 0) {
                const q1 = "UPDATE `mail` SET `location`= ?,`status`= 1 WHERE `gmail`= ?";
                db.query(q1, [location, gmail], (err) => {
                    if (err) return res.status(500).json({ error: err.message });

                    sendmail(
                        '[Subscribe] Welcome to G-Weather-Forecast', 
                        'Thank you for your interest and following. Your location has been updated again.', 
                        gmail
                    );

                    res.status(200).json({gmail: gmail, location: location, status: 1});
                });
            } else {
                const q2 = "INSERT INTO `mail`(`gmail`, `location`, `status`) VALUES (?, ?, 1)";
                db.query(q2, [gmail, location], (err) => {
                    if (err) return res.status(500).json({ error: err.message });

                    sendmail(
                        '[Subscribe] Welcome to G-Weather-Forecast', 
                        'Thank you for your interest and following, hope to provide useful weather information for you. Weather information will be announced every day.', 
                        gmail
                    );

                    sendWheatherInfo(location, gmail);

                    res.status(201).json({ message: 'Subscription created and emails sent' });
                });
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
const sendmail = async (subject, content, recipient, type = 0) => {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'taitran3006@gmail.com',
            pass: 'rpspaukfdyftvnyc'
        }
    });

    let mailOptions = {
        from: 'taitran3006@gmail.com',
        to: recipient,
        subject: subject,
        [type === 1 ? 'html' : 'text']: content
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
    } catch (error) {
        console.error('Error sending email: ', error);
    }
}

const sendWheatherInfo = async (location, mail) => {
    try {
        const response = await axios.get(`http://api.weatherapi.com/v1/forecast.json`, {
            params: {
                key: 'c51aaf3dcc494cc8865115316242607',
                q: location,
                days: 5
            }
        });

        const data = response.data;
        const weatherData = {
            name: data.location.name,
            date: data.forecast.forecastday[0].date,
            forecastday: data.forecast.forecastday.map(day => ({
                day: day.day,
                date: day.date
            }))
        };

        const content = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weather Widget</title>
    <link href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <div class="container">
        <div class="weather-widget card">
            <div class="card-body">
                <h3 class="card-title">${weatherData.name} (${weatherData.date})</h3>
                <p class="card-text">Temperature: ${weatherData.forecastday[0].day.avgtemp_c}°C</p>
                <p class="card-text">Wind: ${weatherData.forecastday[0].day.avgvis_miles} M/S</p>
                <p class="card-text">Humidity: ${weatherData.forecastday[0].day.avghumidity}%</p>
                <div class="weather-status">
                    <img src="https:${weatherData.forecastday[0].day.condition.icon}">
                    <p class="status-text">${weatherData.forecastday[0].day.condition.text}</p>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
`;

        await sendmail(`[${weatherData.name}] ${weatherData.date}`, content, mail, 1);
    } catch (error) {
        console.error('Error sending weather info: ', error.message);
    }
}

app.post('/logout', async (req, res) => {
    const { gmail } = req.body;

    try {
        const q1 = "UPDATE `mail` SET `status`= 0 WHERE `gmail`= ?";
                db.query(q1, [gmail], (err) => {
                    if (err) return res.status(500).json({ error: err.message }); 

                let mailInstance = { gmail, status: 0 };

  
                sendmail('[Unsubscribe] G-Weather-Forecast thank you.', 
                        'Thank you for your interest and following. See you again one day soon.', 
                        gmail);
        
                res.status(201).json(mailInstance);});

        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});





app.listen(8000, () => console.log("server is running in port 8000"));