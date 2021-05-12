const config = require('../config/config.json');
const server_logger = require("./server_logger.js");
const data2arrargv = require('./data2arrargv');
const mysql_connection = require('./mysql_connection');

const _bDebug_mode = process.argv.indexOf("debug") >= 0; //If true, spam the console with debug messages
const logger = server_logger.SERVER_LOGGING(config.log_options.LOG_PATH + '/controller_hub.log', { level: _bDebug_mode ? 'debug' : 'info', add_mqtt: false });
const logger_solace = server_logger.SERVER_LOGGING(config.log_options.LOG_PATH + '/controller_solace.log', { level: _bDebug_mode ? 'debug' : 'info', add_mqtt: false });


const fs = require('fs');

const _ = require("lodash");
const rp = require("request-promise-native");

let mysqlClient = null;
let dbReady = true;


let ceate_mysql_conn_HUB = function () {
    mysqlClient = new mysql_connection();
    let connectionObject = {
        connectionLimit: 10,
        host: config.CSCEHUB_dbconn.host,
        user: config.CSCEHUB_dbconn.user,
        password: config.CSCEHUB_dbconn.password,
        database: config.CSCEHUB_dbconn.database
    }
    mysqlClient.init(connectionObject);
    if (!mysqlClient)
        logger.log("error", "[controller_hub] create mysql HUB failed");
    else {
        dbReady = true;
        logger.log("debug", "[controller_hub] create_mysql_connection(HUB)");
    }
};




let restImageReceived = async function (req, res) {

    try {
        let userDetails = req.body;
        let imageData = userDetails["image"];
        imageData = imageData.replace("data:image/jpg;base64,", "");
        let logObject = req.body;
        logObject["image"] = "image received";
        logger.log("info", "rest image received: " + JSON.stringify(logObject));

        //new array for events
        let handleEventsArray = userDetails["events"];

        let base64Image = imageData;
        let imageBuffer = new Buffer.from(base64Image, "base64");
        let currentdate = new Date();
        let imageFileName = config.piwigo_options.save_img_directory + "image_" + currentdate.getFullYear().toString() + (currentdate.getMonth() + 1).toString() + currentdate.getDate().toString() + currentdate.getHours().toString() + currentdate.getMinutes().toString() + currentdate.getSeconds().toString() + ".jpg";
        logger.log("info", imageFileName);
        fs.writeFileSync(`${imageFileName}`, imageBuffer);


        let url = await uploadImgForUrl(`${imageFileName}`, config.piwigo_options.category);

        fs.unlinkSync(`${imageFileName}`);

        let newUrl = url.url;

        newUrl = newUrl.replace(config.piwigo_options.url, "/");

        if (handleEventsArray.length > 1) {
            let eventCounter = 0;
            for (i = 0; i < handleEventsArray.length; i++) {
                let type = ((userDetails["events"][i][0]["event"])[0])["type"];
                let desc = ((userDetails["events"][i][0]["event"])[2])["desc"];
                let time = ((userDetails["events"][i][0]["event"])[3])["time"];
                let camera = ((userDetails["events"][i][0]["event"])[4])["camera"];
                let device = ((userDetails["events"][i][0]["event"])[1])["alarm_id"];
                let siteID = ((userDetails["events"][i][0]["event"])[5])["siteID"];

                let sqlObject = { "project_id": siteID, "state": 1, "sensor_id": camera, "image_id": 0, "type": 2, "serverity": 2, "description": desc, "url": newUrl }

                let queryReturn = data2arrargv.insertAlarmPhotoMultiple(sqlObject, eventCounter);
                mysqlClient.directPoolQueryTransaction(queryReturn);

                eventCounter += 2;
                logger.log("info", `data received multiple: type-${type} desc-${desc} time-${time} camera-${camera} device-${device} url-${url.url}`);
            }
        } else {
            let type = ((userDetails["events"][0][0]["event"])[0])["type"];
            let desc = ((userDetails["events"][0][0]["event"])[2])["desc"];
            let time = ((userDetails["events"][0][0]["event"])[3])["time"];
            let camera = ((userDetails["events"][0][0]["event"])[4])["camera"];
            let device = ((userDetails["events"][0][0]["event"])[1])["alarm_id"];
            let siteID = ((userDetails["events"][0][0]["event"])[5])["siteID"];

            let sqlObject = { "project_id": siteID, "state": 1, "sensor_id": camera, "image_id": 0, "type": 2, "serverity": 2, "description": desc, "url": newUrl }

            let queryReturn = data2arrargv.insertAlarmPhoto(sqlObject);
            mysqlClient.directPoolQueryTransaction(queryReturn);

            logger.log("info", `data received single: type-${type} desc-${desc} time-${time} camera-${camera} device-${device} url-${url.url}`);
        }



        res.status(200).send({ "result": "Image upload was successful." });
    } catch (e) {
        res.status(406).send({ "result": "Image upload failed." });
        logger_solace.log("info", "[controller_hub]-[REST API] restImageReceived error: " + e);
    }
}





function utf8Decode(utf8String) {
    if (typeof utf8String != 'string') throw new TypeError('parameter ‘utf8String’ is not a string');
    const unicodeString = utf8String.replace(
        /[\u00e0-\u00ef][\u0080-\u00bf][\u0080-\u00bf]/g,
        function (c) {
            var cc = ((c.charCodeAt(0) & 0x0f) << 12) | ((c.charCodeAt(1) & 0x3f) << 6) | (c.charCodeAt(2) & 0x3f);
            return String.fromCharCode(cc);
        }
    ).replace(
        /[\u00c0-\u00df][\u0080-\u00bf]/g,
        function (c) {
            var cc = (c.charCodeAt(0) & 0x1f) << 6 | c.charCodeAt(1) & 0x3f;
            return String.fromCharCode(cc);
        }
    );
    return unicodeString;
}




//PIWIGO FUNCTIONS start
async function login() {
    const uri = fullUri(`pwg.session.login`);
    const res = await rp({
        uri,
        method: "POST",
        form: {
            "username": config.piwigo_options.user,
            "password": config.piwigo_options.password
        },
        json: true,
        jar: true
    });
    return res;
}

function fullUri(m) {
    return `${config.piwigo_options.url}/ws.php?format=json&method=${m}`;
}

async function upload(img, meta) {
    const uri = fullUri(`pwg.images.addSimple`);
    const res = await rp({
        uri,
        method: "POST",
        formData: {
            image: [fs.createReadStream(img)],
            ...meta
        },
        json: true,
        jar: true
    });
    return res;
}

async function getImgInfo(imgId) {
    const uri = `${fullUri("pwg.images.getInfo")}&image_id=${imgId}`;
    const res = await rp({
        uri,
        method: "GET",
        json: true,
        jar: true
    });
    return res;
}

async function uploadImgForUrl(img, meta) {
    const resLogin = await login();

    const resUpload = await upload(img, meta);
    const imgId = _.get(resUpload, "result.image_id", -1);
    const resImgInfo = await getImgInfo(imgId);
    const imgUrl = _.get(resImgInfo, "result.element_url", null);
    let returnURL = { "url": imgUrl, "id": imgId }
    logger.log("info", "uploadImgForUrl: " + JSON.stringify(returnURL))
    return returnURL;
}
//PIWIGO FUNCTIONS end



module.exports = {
    ceate_mysql_conn_HUB,
    restImageReceived
};
