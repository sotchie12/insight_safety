const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser')
const config = require('../config/config.json');
const controller_hub = require('../server_modules/controller_hub');

router.use(bodyParser.json(config.json_uploaad_limit))
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

//Rest API routes
router.post('/device/site_safety/hub/v1', controller_hub.restImageReceived);

module.exports = router;

