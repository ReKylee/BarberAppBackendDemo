import { Router } from "express";
import { BarberController } from "../Controllers/BarberController";

const router = Router();
const barberController = new BarberController();

// Barber management routes
router.get("/", barberController.getAllBarbers);
router.post("/", barberController.createBarber);
router.get("/search", barberController.getBarberByName);
router.get("/:barberId", barberController.getBarberById);

export default router;
