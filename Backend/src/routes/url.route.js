const express= require('express');
const urlRouter=express.Router();
const {handleGenerateNewShortURL,handleAnalytics} =require('../controller/url.controller');

urlRouter.post('/',handleGenerateNewShortURL);

urlRouter.get('/analytics',handleAnalytics);

module.exports=urlRouter;