"use strict";
const _ = require("lodash");
const config = require('../config/config.json');
const server_logger = require("./server_logger");


const moment = require('moment');

const _bDebug_mode = process.argv.indexOf("debug") >= 0; //If true, spam the console with debug messages
const logger = server_logger.SERVER_LOGGING(config.log_options.LOG_PATH + '/data2arrargv.log', { level: _bDebug_mode ? 'debug' : 'info', add_mqtt: false });




function insertAlarmPhoto(obj) {
    let fix_update = moment().format("YYYY-MM-DD HH:mm:ss");

    const a = `INSERT INTO alarm (project_id, state, sensor_id, image_id, type, serverity, description, fix_update, url) Values('${obj.project_id}', ${obj.state}, '${obj.sensor_id}', '${obj.image_id}', '${obj.type}', '${obj.serverity}', '${obj.description}', '${fix_update}', '${obj.url}');`
    logger.log("debug", `[data2arrargv] insertAlarmPhoto query a: ${a}` );
    return a;
}

function insertAlarmPhotoMultiple(obj, sec) {
    let fix_update = moment().add(sec, 'seconds').format("YYYY-MM-DD HH:mm:ss");

    const a = `INSERT INTO alarm (project_id, state, sensor_id, image_id, type, serverity, description, fix_update, url) Values('${obj.project_id}', ${obj.state}, '${obj.sensor_id}', '${obj.image_id}', '${obj.type}', '${obj.serverity}', '${obj.description}', '${fix_update}', '${obj.url}');`
    logger.log("debug", `[data2arrargv] insertAlarmPhotoMultiple query a: ${a}` );
    return a;
}




module.exports = {
    insertAlarmPhoto,
    insertAlarmPhotoMultiple
}