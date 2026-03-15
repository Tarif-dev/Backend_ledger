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

/**
 * - GET /api/accounts/balance
 * - Get balance of user account
 * - Protected Route
 */
router.get('/balance',authMiddleware.authMiddleware,accountController.getBalanceController) 

/**
 * - GET /api/accounts/
 * - Get all accounts of the user
 * - Protected Route
 */
router.get('/',authMiddleware.authMiddleware,accountController.getAllAccountsController)

module.exports = router