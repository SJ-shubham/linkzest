const express= require('express');
const urlRouter=express.Router();
const {handleGenerateNewShortURL,
       handleAnalytics,handleEditUrl,
       handleUrlStatus,
       handleDeleteMode} =require('../controller/url.controller');

urlRouter.post('/',handleGenerateNewShortURL);

urlRouter.get('/analytics',handleAnalytics);

urlRouter.patch('/:shortId/edit',handleEditUrl);

urlRouter.patch('/:shortId/status',handleUrlStatus);

urlRouter.patch(':shortId/delete',handleDeleteMode);

module.exports=urlRouter;