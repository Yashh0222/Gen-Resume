const express = require("express");
const { Router } = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const authController = require("../controllers/auth.controller");

const authRouter = express.Router();

/**
 * @route Post /api/auth/register
 * @description Register a new user
 * @access Public
 */

authRouter.post('/register', authController.registerUserController); 

/**
 * @route Post /api/auth/login
 * @description Login an existing user
 * @access Public
 */
authRouter.post('/login', authController.loginUserController);

/**
 * @route Get /api/auth/logout
 * @description Logout an existing user
 * @access public
 */
authRouter.get('/logout', authController.logoutUserController);

/**
 * @route GET /api/auth/get-me
 * @description Get current user
 * @access private
 */
authRouter.get('/get-me', authMiddleware.authUser, authController.getMeController);

module.exports = authRouter