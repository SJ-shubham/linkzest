const express=require('express');
const redirectRoute=express.Router();
const {handleRedirect}=require('../controller/url.controller');

redirectRoute.get('/:shortId',handleRedirect);

module.exports={
    redirectRoute,
}