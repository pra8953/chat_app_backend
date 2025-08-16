const router = require('express').Router();
const authRouter = require('./authRoute');


router.use('/',authRouter);



module.exports = router;