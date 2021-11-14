// https://thingspeak.com/channels/new => CHANNEL_IDs, WRITE_API_KEYs
// https://console.thethingsnetwork.org/applications/TTN_APP_ID => TTN_DEVICE_IDs

const http = require("http"),
  https = require("https"),
  qs = require("querystring");

const appId = "TTN_APP_ID";
const writeApiKeys = {
  "TTN_DEVICE_ID_1": "WRITE_API_KEY_1", // CHANNEL_ID_1
  "TTN_DEVICE_ID_2": "WRITE_API_KEY_2", // CHANNEL_ID_2
  "TTN_DEVICE_ID_3": "WRITE_API_KEY_3", // CHANNEL_ID_3
};

//const host = "127.0.0.1"; // loopback address
//const host = "192.168.2.23"; // local address
const host = "0.0.0.0"; // any incoming address
const port = 8080;

const server = http.createServer((ttnReq, ttnRes) => {

  // Handle the (Webhook) Web request from TTN

  console.log(ttnReq);

  let ttnReqData = "";

  ttnReq.on('data', (data) => {
    ttnReqData += data;
  });

  ttnReq.on('end', () => {

    // Convert the data from TTN to ThingSpeak data format

    const msg = JSON.parse(ttnReqData);
    console.log(msg);

    const bytes = Buffer.from(msg.data.uplink_message.frm_payload, 'base64');
    // assume two float * 100, high/low byte
    const x = ((bytes[0] << 8) | bytes[1]) / 100.0;
    const y = ((bytes[2] << 8) | bytes[3]) / 100.0;

    // Prepare the Web request to ThingSpeak

    const tsReqData = qs.stringify({
      "api_key": writeApiKeys[msg.data.end_device_ids.device_id],
      "field1": x,
      "field2": y
    });

    console.log(bytes);
    console.log(tsReqData);

    const tsReqOptions = {
      hostname: "api.thingspeak.com",
      path: "/update",
      method: "POST",
      port: 443,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(tsReqData)
      }
	};
  
    // Execute the Web request to ThingSpeak

    const tsReq = https.request(tsReqOptions, (tsRes) => {
      let tsResData = "";

      tsRes.on("data", (chunk) => {
        tsResData += chunk;
      });

      tsRes.on("end", () => {
        console.log(tsResData);

        // Success: Reply to the original Web request from TTN

        ttnRes.statusCode = 200;
        ttnRes.setHeader("Content-Type", "text/plain");
        ttnRes.end("200 OK");
      });
    });

    tsReq.on("error", (err) => {
      console.log("Error: " + err.message);

      // Error: Reply to the original Web request from TTN

      ttnRes.statusCode = 500;
      ttnRes.setHeader("Content-Type", "text/plain");
      ttnRes.end("500 Internal Server Error");
    });

    tsReq.write(tsReqData);
    tsReq.end();
  });

//  // Reply immedately to the original Web request from TTN

//  ttnRes.statusCode = 200;
//  ttnRes.setHeader("Content-Type", "text/plain");
//  ttnRes.end("200 OK");
});

server.listen(port, host, () => {
  console.log("Server running on port " + port);
});