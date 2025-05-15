import { Router } from "express";
import { UserController } from "../Controllers/UserController";

const userRoutes = Router();
const userController = new UserController();

// Get all users
userRoutes.get("/", userController.getAllUsers);

// Create a new user
userRoutes.post("/", userController.createUser);

// Get user by name
userRoutes.get("/search", userController.getUserByName);

// Get user by ID
userRoutes.get("/:id", userController.getUserById);

export default userRoutes;
