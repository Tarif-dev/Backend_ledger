const express = require("express");
const authController = require("../controllers/auth.controller");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware")


/* POST /api/auth/register
   - Register a new user
   - Public Route
*/
router.post("/register", authController.userRegisterController);


/**
 * POST /api/auth/login
 * - Login user and return JWT token
 * - Public Route
 */
router.post('/login',authController.userLoginController)


/**
 * POST /api/auth/logout
 * - Logout user by blacklisting the token
 * - Protected Route
 */
router.post('/logout',authMiddleware.authMiddleware,authController.userLogoutController)

module.exports = router;
