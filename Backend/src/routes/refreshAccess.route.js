const express = require("express");
const router = express.Router();
const { handleRefreshToken } = require("../controller/refreshToken.controller");

router.get("-access/", handleRefreshToken);

module.exports = router;