const express = require('express')
const accountController = require('../controllers/account.controller')
const authMiddleware = require("../middleware/auth.middleware")
const router = express.Router()

/**
 * - POST /api/accounts/
 * - Create a new account
 * - Protected Route
 */
router.post('/',authMiddleware.authMiddleware,accountController.createAccountController)

module.exports = router