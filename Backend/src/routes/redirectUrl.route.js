const express=require('express');
const redirectRoute=express.Router();
const {handleRedirect}=require('../controller/redirect.controller');

redirectRoute.get('/:shortId',handleRedirect);

module.exports=redirectRoute;